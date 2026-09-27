import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { io as connect, type Socket } from 'socket.io-client';
import type { ClientToServer, Phase, RoomState, ServerToClient } from '../../shared/protocol.ts';
import { distribute, orderPhotos, scoreFor, type Timings } from '../src/game.ts';
import { startServer, type Started } from '../src/server.ts';

const FAST: Timings = {
  answerMs: 400,
  graceMs: 150,
  revealMs: 80,
  leaderboardMs: 80,
  collectTimeoutMs: 500,
  lobbyDisconnectMs: 100,
  emptyRoomMs: 200,
};

/** A fake JPEG: the server only checks the magic bytes. */
function fakeJpeg(tag: string): string {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(tag)]).toString('base64');
}

type Client = Socket<ServerToClient, ClientToServer> & {
  playerId: string;
  state: RoomState | null;
  photoRequests: number[];
};

let server: Started;
const clients: Client[] = [];

function client(name: string, opts: { photos?: boolean } = {}): Client {
  const socket = connect(`http://localhost:${server.port}`, { transports: ['websocket'], forceNew: true }) as Client;
  socket.playerId = `${name}-${Math.random().toString(36).slice(2)}`;
  socket.state = null;
  socket.photoRequests = [];
  socket.on('room:state', (s) => {
    socket.state = s;
  });
  socket.on('photos:request', ({ count }, ack) => {
    socket.photoRequests.push(count);
    if (opts.photos === false) return ack({ photos: [] });
    ack({ photos: Array.from({ length: count }, (_, i) => fakeJpeg(`${name}-${i}`)) });
  });
  clients.push(socket);
  return socket;
}

function waitFor(c: Client, pred: (s: RoomState) => boolean, ms = 3000): Promise<RoomState> {
  return new Promise((resolve, reject) => {
    if (c.state && pred(c.state)) return resolve(c.state);
    const timer = setTimeout(() => {
      c.off('room:state', check);
      reject(new Error(`timed out waiting; last phase=${c.state?.phase}`));
    }, ms);
    function check(s: RoomState) {
      if (pred(s)) {
        clearTimeout(timer);
        c.off('room:state', check);
        resolve(s);
      }
    }
    c.on('room:state', check);
  });
}

const phase = (p: Phase) => (s: RoomState) => s.phase === p;

async function create(c: Client, name: string): Promise<string> {
  const r = await c.emitWithAck('room:create', { name, playerId: c.playerId });
  assert.ok(r.ok, !r.ok ? r.error : '');
  return r.code;
}

async function join(c: Client, code: string, name: string) {
  return c.emitWithAck('room:join', { code, name, playerId: c.playerId });
}

before(async () => {
  server = await startServer(0, FAST);
});

after(async () => {
  for (const c of clients) c.disconnect();
  await server.close();
});

describe('scoring', () => {
  it('awards up to 500 for fast correct answers and 0 for wrong ones', () => {
    assert.equal(scoreFor(true, 0, 5000), 500);
    assert.equal(scoreFor(true, 2500, 5000), 375);
    assert.equal(scoreFor(true, 5000, 5000), 250);
    assert.equal(scoreFor(true, 9999, 5000), 250);
    assert.equal(scoreFor(false, 0, 5000), 0);
  });
});

describe('photo planning', () => {
  it('distributes rounds evenly', () => {
    const d = distribute(10, ['a', 'b', 'c']);
    assert.equal(
      [...d.values()].reduce((a, b) => a + b, 0),
      10,
    );
    for (const n of d.values()) assert.ok(n === 3 || n === 4);
  });

  it('avoids the same owner twice in a row when possible', () => {
    for (let trial = 0; trial < 500; trial++) {
      const photos = [
        ...Array.from({ length: 4 }, () => ({ ownerId: 'a' })),
        ...Array.from({ length: 3 }, () => ({ ownerId: 'b' })),
        ...Array.from({ length: 3 }, () => ({ ownerId: 'c' })),
      ];
      const ordered = orderPhotos(photos);
      assert.equal(ordered.length, 10);
      for (let i = 1; i < ordered.length; i++) assert.notEqual(ordered[i].ownerId, ordered[i - 1].ownerId);
    }
  });
});

describe('lobby', () => {
  it('creates a room, lets others join, and rejects bad joins', async () => {
    const host = client('host');
    const guest = client('guest');
    const code = await create(host, 'Ava');
    assert.match(code, /^[A-Z]{4}$/);

    assert.deepEqual(await join(guest, 'ZZZZ', 'Ben'), { ok: false, error: 'No game found with code ZZZZ.' });
    const dupe = await join(guest, code, 'ava');
    assert.equal(dupe.ok, false);
    const ok = await join(guest, code.toLowerCase(), 'Ben');
    assert.ok(ok.ok);

    const s = await waitFor(host, (s) => s.players.length === 2);
    assert.equal(s.you.isHost, true);
    assert.deepEqual(
      s.players.map((p) => p.name),
      ['Ava', 'Ben'],
    );
    assert.notEqual(s.players[0].color, s.players[1].color);

    // Only the host can change settings or start.
    guest.emit('game:settings', { rounds: 3 });
    const notHost = await guest.emitWithAck('game:start');
    assert.equal(notHost.ok, false);
    host.emit('game:settings', { rounds: 99 });
    assert.equal((await waitFor(guest, (s) => s.settings.rounds !== 10)).settings.rounds, 30);

    host.emit('room:leave');
    const after = await waitFor(guest, (s) => s.players.length === 1);
    assert.equal(after.you.isHost, true, 'host role moves to the remaining player');
    guest.emit('room:leave');
  });

  it('needs at least two players to start', async () => {
    const solo = client('solo');
    await create(solo, 'Solo');
    const r = await solo.emitWithAck('game:start');
    assert.deepEqual(r, { ok: false, error: 'You need at least 2 players to start.' });
    solo.emit('room:leave');
  });
});

describe('full game', () => {
  it('plays every round, scores answers and finishes', async () => {
    const [a, b, c] = [client('a'), client('b'), client('c')];
    const code = await create(a, 'Ava');
    assert.ok((await join(b, code, 'Ben')).ok);
    assert.ok((await join(c, code, 'Cat')).ok);
    await waitFor(a, (s) => s.players.length === 3);
    a.emit('game:settings', { rounds: 4 });
    await waitFor(a, (s) => s.settings.rounds === 4);
    assert.ok((await a.emitWithAck('game:start')).ok);

    // Every player is asked for a share of the photos.
    await waitFor(a, phase('question'));
    const requested = [a, b, c].map((x) => x.photoRequests.reduce((n, k) => n + k, 0));
    assert.equal(
      requested.reduce((x, y) => x + y, 0),
      4,
    );
    for (const n of requested) assert.ok(n >= 1 && n <= 2);

    const totals = new Map<string, number>();
    const byId = new Map([a, b, c].map((x) => [x.playerId, x]));
    for (let round = 0; round < 4; round++) {
      const s = await waitFor(a, (s) => s.phase === 'question' && s.round?.index === round);
      assert.equal(s.round!.total, 4);
      assert.equal(s.round!.ownerId, null, 'owner is hidden while guessing');
      assert.equal(s.round!.choices.length, 3);

      // The photo is downloadable over HTTP.
      const res = await fetch(`http://localhost:${server.port}${s.round!.photoUrl}`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'image/jpeg');
      const body = Buffer.from(await res.arrayBuffer()).toString();
      const ownerName = body.slice(4).split('-')[0]; // our fake jpeg embeds the client tag
      const owner = byId.get([...byId.keys()].find((id) => id.startsWith(`${ownerName}-`))!)!;

      const ownerState = await waitFor(owner, (s) => s.round?.index === round);
      assert.equal(ownerState.you.ownsCurrentPhoto, true);
      const ownerTry = await owner.emitWithAck('round:answer', { round, guessId: owner.playerId, elapsedMs: 10 });
      assert.equal(ownerTry.ok, false, "owners can't guess their own photo");

      const guessers = [a, b, c].filter((x) => x !== owner);
      // First guesser is right and fast, second is wrong.
      assert.ok((await guessers[0].emitWithAck('round:answer', { round, guessId: owner.playerId, elapsedMs: 0 })).ok);
      const again = await guessers[0].emitWithAck('round:answer', { round, guessId: owner.playerId, elapsedMs: 0 });
      assert.equal(again.ok, false, 'one answer per round');
      assert.ok(
        (await guessers[1].emitWithAck('round:answer', { round, guessId: guessers[0].playerId, elapsedMs: 0 })).ok,
      );

      // Everyone answered, so the round ends early and reveals the owner.
      const reveal = await waitFor(a, (s) => s.phase === 'reveal' && s.round?.index === round);
      assert.equal(reveal.round!.ownerId, owner.playerId);
      const g0 = reveal.round!.guesses![guessers[0].playerId];
      const g1 = reveal.round!.guesses![guessers[1].playerId];
      assert.equal(g0.correct, true);
      assert.ok(g0.points > 400 && g0.points <= 500, `fast correct answer scored ${g0.points}`);
      assert.deepEqual([g1.correct, g1.points], [false, 0]);
      totals.set(guessers[0].playerId, (totals.get(guessers[0].playerId) ?? 0) + g0.points);

      if (round < 3) {
        const board = await waitFor(a, (s) => s.phase === 'leaderboard' && s.round?.index === round);
        assert.ok(board.nextPhotoUrl, 'next photo is announced for preloading');
      }
    }

    const final = await waitFor(a, phase('finished'));
    for (const p of final.players) assert.equal(p.score, totals.get(p.id) ?? 0);

    // Host can start over; scores reset and photos are discarded.
    const lastPhoto = final.round!.photoUrl;
    a.emit('game:again');
    const lobby = await waitFor(b, phase('lobby'));
    assert.ok(lobby.players.every((p) => p.score === 0));
    assert.equal((await fetch(`http://localhost:${server.port}${lastPhoto}`)).status, 404);
    for (const x of [a, b, c]) x.emit('room:leave');
  });

  it('times out unanswered rounds and covers players without photos', async () => {
    const a = client('a2');
    const b = client('b2', { photos: false });
    const code = await create(a, 'Ava');
    assert.ok((await join(b, code, 'Ben')).ok);
    await waitFor(a, (s) => s.players.length === 2);
    a.emit('game:settings', { rounds: 2 });
    await waitFor(a, (s) => s.settings.rounds === 2);
    assert.ok((await a.emitWithAck('game:start')).ok);

    const q = await waitFor(a, phase('question'));
    assert.equal(q.round!.total, 2, 'Ava covers the rounds Ben could not');
    assert.equal(q.you.ownsCurrentPhoto, true);

    // Nobody answers: the round closes on its own.
    const reveal = await waitFor(a, phase('reveal'));
    assert.deepEqual(reveal.round!.guesses, {});
    const late = await b.emitWithAck('round:answer', { round: 0, guessId: a.playerId, elapsedMs: 0 });
    assert.equal(late.ok, false);
    a.emit('room:leave');
    b.emit('room:leave');
  });

  it('lets a player reconnect mid-game and stops when too few remain', async () => {
    const a = client('a3');
    const b = client('b3');
    const code = await create(a, 'Ava');
    assert.ok((await join(b, code, 'Ben')).ok);
    await waitFor(a, (s) => s.players.length === 2);
    a.emit('game:settings', { rounds: 6 });
    await waitFor(a, (s) => s.settings.rounds === 6);
    await a.emitWithAck('game:start');
    await waitFor(b, phase('question'));

    // Ben's phone drops and comes back with the same player id.
    const playerId = b.playerId;
    b.disconnect();
    await waitFor(a, (s) => s.phase === 'lobby' && s.notice !== null);

    // With only one player left the game was stopped, but Ben can rejoin the lobby.
    const b2 = client('b3');
    b2.playerId = playerId;
    assert.ok((await join(b2, code, 'Ben')).ok);
    const s = await waitFor(a, (s) => s.players.length === 2 && s.players.every((p) => p.connected));
    assert.equal(s.phase, 'lobby');
    a.emit('room:leave');
    b2.emit('room:leave');
  });

  it('refuses to join a game already in progress', async () => {
    const [a, b, late] = [client('a4'), client('b4'), client('late')];
    const code = await create(a, 'Ava');
    await join(b, code, 'Ben');
    await waitFor(a, (s) => s.players.length === 2);
    await a.emitWithAck('game:start');
    await waitFor(a, (s) => s.phase !== 'lobby');
    assert.deepEqual(await join(late, code, 'Late'), { ok: false, error: 'That game has already started.' });
    a.emit('room:leave');
    b.emit('room:leave');
  });
});
