import { randomBytes, randomInt } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type {
  Ack,
  ClientToServer,
  Guess,
  Phase,
  PhotoResponse,
  PublicPlayer,
  RoomState,
  ServerToClient,
} from '../../shared/protocol.ts';

export interface Timings {
  /** How long players have to guess. */
  answerMs: number;
  /** Extra server-side time to absorb network latency and image load. */
  graceMs: number;
  revealMs: number;
  leaderboardMs: number;
  /** How long to wait for a player's phone to send its photos. */
  collectTimeoutMs: number;
  /** A player who drops out of the lobby is removed after this long. */
  lobbyDisconnectMs: number;
  /** A room with nobody connected is deleted after this long. */
  emptyRoomMs: number;
}

export const DEFAULT_TIMINGS: Timings = {
  answerMs: 5000,
  graceMs: 1500,
  revealMs: 3500,
  leaderboardMs: 4500,
  collectTimeoutMs: 45000,
  lobbyDisconnectMs: 20000,
  emptyRoomMs: 120000,
};

export const MAX_POINTS = 500;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 30;
export const DEFAULT_ROUNDS = 10;
export const MAX_PLAYERS = 16;
export const MIN_PLAYERS = 2;
export const MAX_NAME_LENGTH = 16;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export const PLAYER_COLORS = [
  '#FF3CAC', // hot pink
  '#FFB800', // sunflower
  '#00D4FF', // electric cyan
  '#7CFF4F', // lime
  '#FF6B35', // tangerine
  '#B15CFF', // violet
  '#00F5A0', // mint
  '#FF4D6D', // watermelon
  '#4D7CFF', // royal blue
  '#FFE14D', // lemon
  '#FF7AF5', // bubblegum
  '#2EF2E0', // aqua
  '#FF9F1C', // orange
  '#9DFF00', // chartreuse
  '#C77DFF', // lavender
  '#FF5E5B', // coral
];

/**
 * Correct answers earn between 250 and 500 points: the full 500 for an
 * instant answer, sliding linearly down to 250 at the buzzer. Wrong or
 * missing answers earn nothing.
 */
export function scoreFor(correct: boolean, elapsedMs: number, answerMs: number): number {
  if (!correct) return 0;
  const t = Math.min(Math.max(elapsedMs, 0), answerMs) / answerMs;
  return Math.round(MAX_POINTS * (1 - t / 2));
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
  return name.length > 0 ? name : null;
}

/** Splits `total` as evenly as possible among `ids`, with the remainder going to random ids. */
export function distribute(total: number, ids: string[]): Map<string, number> {
  const out = new Map(ids.map((id) => [id, 0]));
  if (ids.length === 0) return out;
  const base = Math.floor(total / ids.length);
  for (const id of ids) out.set(id, base);
  for (const id of shuffle(ids).slice(0, total % ids.length)) out.set(id, out.get(id)! + 1);
  return out;
}

/** Orders photos randomly while avoiding the same owner twice in a row when possible. */
export function orderPhotos<T extends { ownerId: string }>(photos: T[]): T[] {
  const byOwner = new Map<string, T[]>();
  for (const p of shuffle(photos)) {
    const list = byOwner.get(p.ownerId) ?? [];
    list.push(p);
    byOwner.set(p.ownerId, list);
  }
  const out: T[] = [];
  let last: string | null = null;
  while (out.length < photos.length) {
    const remaining = photos.length - out.length;
    const owners = [...byOwner.entries()].filter(([, list]) => list.length > 0);
    const others = owners.filter(([id]) => id !== last);
    // An owner holding more than half of what's left must go now, or they'd
    // be forced to repeat later.
    const majority = others.find(([, list]) => list.length * 2 > remaining);
    const pool = majority ? [majority] : others.length > 0 ? others : owners;
    // Weight by how many photos an owner has left so nobody gets bunched at the end.
    let pick = randomInt(pool.reduce((n, [, list]) => n + list.length, 0));
    for (const [id, list] of pool) {
      if (pick < list.length) {
        out.push(list.pop()!);
        last = id;
        break;
      }
      pick -= list.length;
    }
  }
  return out;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sniffImage(data: Buffer): string | null {
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (data.length > 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

interface SocketData {
  playerId?: string;
  code?: string;
}

type IO = Server<ClientToServer, ServerToClient, {}, SocketData>;
type Sock = Socket<ClientToServer, ServerToClient, {}, SocketData>;

export interface Photo {
  id: string;
  ownerId: string;
  data: Buffer;
  mime: string;
}

interface Player {
  id: string;
  name: string;
  color: string;
  score: number;
  lastGain: number;
  socket: Sock | null;
  photosReady: boolean;
  removeTimer: NodeJS.Timeout | null;
}

interface Round {
  index: number;
  photo: Photo;
  startedAt: number;
  deadline: number;
  answers: Map<string, Guess>;
}

interface Room {
  code: string;
  hostId: string;
  phase: Phase;
  rounds: number;
  players: Map<string, Player>;
  /** Player ids taking part in the current game (fixed when the game starts). */
  roster: string[];
  photos: Photo[];
  round: Round | null;
  timer: NodeJS.Timeout | null;
  emptyTimer: NodeJS.Timeout | null;
  /** Bumped whenever a game starts or is abandoned, to cancel stale async work. */
  gameId: number;
  notice: string | null;
}

export class GameServer {
  private rooms = new Map<string, Room>();
  private photoIndex = new Map<string, Photo>();
  private t: Timings;

  constructor(io: IO, timings: Timings = DEFAULT_TIMINGS) {
    this.t = timings;
    io.on('connection', (socket) => this.onConnection(socket));
  }

  getPhoto(id: string): Photo | undefined {
    return this.photoIndex.get(id);
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  // ---------------------------------------------------------------- sockets

  private onConnection(socket: Sock) {
    socket.on('room:create', (p, ack) => {
      if (typeof ack !== 'function') return;
      const name = cleanName(p?.name);
      const playerId = typeof p?.playerId === 'string' ? p.playerId.slice(0, 64) : '';
      if (!name) return ack({ ok: false, error: 'Please enter a name.' });
      if (!playerId) return ack({ ok: false, error: 'Missing player id.' });
      this.leaveCurrent(socket);
      const room = this.createRoom(playerId);
      this.addPlayer(room, playerId, name, socket);
      ack({ ok: true, code: room.code });
      this.broadcast(room);
    });

    socket.on('room:join', (p, ack) => {
      if (typeof ack !== 'function') return;
      const code = typeof p?.code === 'string' ? p.code.trim().toUpperCase() : '';
      const name = cleanName(p?.name);
      const playerId = typeof p?.playerId === 'string' ? p.playerId.slice(0, 64) : '';
      if (!name) return ack({ ok: false, error: 'Please enter a name.' });
      if (!playerId) return ack({ ok: false, error: 'Missing player id.' });
      const room = this.rooms.get(code);
      if (!room) return ack({ ok: false, error: `No game found with code ${code || '—'}.` });

      const existing = room.players.get(playerId);
      if (existing) {
        // Same device coming back (app was backgrounded, network blipped, ...).
        if (existing.socket && existing.socket !== socket) existing.socket.disconnect(true);
        this.leaveCurrent(socket, room.code);
        this.attach(room, existing, socket);
        if (room.phase === 'lobby') existing.name = this.uniqueName(room, name, playerId) ?? existing.name;
        ack({ ok: true, code: room.code });
        this.broadcast(room);
        return;
      }

      if (room.phase !== 'lobby') return ack({ ok: false, error: 'That game has already started.' });
      if (room.players.size >= MAX_PLAYERS) return ack({ ok: false, error: 'That room is full.' });
      const unique = this.uniqueName(room, name, playerId);
      if (!unique) return ack({ ok: false, error: `Someone in that room is already called ${name}.` });
      this.leaveCurrent(socket);
      this.addPlayer(room, playerId, unique, socket);
      ack({ ok: true, code: room.code });
      this.broadcast(room);
    });

    socket.on('room:leave', () => this.leaveCurrent(socket));

    socket.on('game:settings', (p) => {
      const ctx = this.context(socket);
      if (!ctx || ctx.room.hostId !== ctx.player.id || ctx.room.phase !== 'lobby') return;
      const rounds = Number(p?.rounds);
      if (!Number.isFinite(rounds)) return;
      ctx.room.rounds = Math.min(MAX_ROUNDS, Math.max(MIN_ROUNDS, Math.round(rounds)));
      this.broadcast(ctx.room);
    });

    socket.on('game:start', (ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const ctx = this.context(socket);
      if (!ctx) return reply({ ok: false, error: 'You are not in a room.' });
      const { room, player } = ctx;
      if (room.hostId !== player.id) return reply({ ok: false, error: 'Only the host can start the game.' });
      if (room.phase !== 'lobby') return reply({ ok: false, error: 'The game has already started.' });
      const connected = [...room.players.values()].filter((pl) => pl.socket);
      if (connected.length < MIN_PLAYERS)
        return reply({ ok: false, error: `You need at least ${MIN_PLAYERS} players to start.` });
      reply({ ok: true });
      void this.startGame(room);
    });

    socket.on('game:again', () => {
      const ctx = this.context(socket);
      if (!ctx || ctx.room.hostId !== ctx.player.id || ctx.room.phase !== 'finished') return;
      this.backToLobby(ctx.room, null);
    });

    socket.on('round:answer', (p, ack) => {
      const reply: (r: Ack) => void = typeof ack === 'function' ? ack : () => {};
      const ctx = this.context(socket);
      if (!ctx) return reply({ ok: false, error: 'You are not in a room.' });
      reply(this.answer(ctx.room, ctx.player, p));
    });

    socket.on('disconnect', () => this.onDisconnect(socket));
  }

  private context(socket: Sock): { room: Room; player: Player } | null {
    const { code, playerId } = socket.data;
    const room = code ? this.rooms.get(code) : undefined;
    const player = room && playerId ? room.players.get(playerId) : undefined;
    if (!room || !player || player.socket !== socket) return null;
    return { room, player };
  }

  // ------------------------------------------------------------------ rooms

  private createRoom(hostId: string): Room {
    let code: string;
    do {
      code = Array.from({ length: 4 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('');
    } while (this.rooms.has(code));
    const room: Room = {
      code,
      hostId,
      phase: 'lobby',
      rounds: DEFAULT_ROUNDS,
      players: new Map(),
      roster: [],
      photos: [],
      round: null,
      timer: null,
      emptyTimer: null,
      gameId: 0,
      notice: null,
    };
    this.rooms.set(code, room);
    return room;
  }

  private uniqueName(room: Room, name: string, playerId: string): string | null {
    const taken = [...room.players.values()].some(
      (p) => p.id !== playerId && p.name.toLowerCase() === name.toLowerCase(),
    );
    return taken ? null : name;
  }

  private addPlayer(room: Room, id: string, name: string, socket: Sock) {
    const used = new Set([...room.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[room.players.size % PLAYER_COLORS.length];
    const player: Player = {
      id,
      name,
      color,
      score: 0,
      lastGain: 0,
      socket: null,
      photosReady: false,
      removeTimer: null,
    };
    room.players.set(id, player);
    this.attach(room, player, socket);
  }

  private attach(room: Room, player: Player, socket: Sock) {
    if (player.removeTimer) clearTimeout(player.removeTimer);
    player.removeTimer = null;
    player.socket = socket;
    socket.data.code = room.code;
    socket.data.playerId = player.id;
    void socket.join(room.code);
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
    if (!room.players.get(room.hostId)?.socket) room.hostId = player.id;
  }

  /** Detaches the socket from whatever room it's in (optionally except `keep`). */
  private leaveCurrent(socket: Sock, keep?: string) {
    const ctx = this.context(socket);
    socket.data.code = undefined;
    socket.data.playerId = undefined;
    if (!ctx || ctx.room.code === keep) return;
    const { room, player } = ctx;
    void socket.leave(room.code);
    player.socket = null;
    if (room.phase === 'lobby' || room.phase === 'finished') this.removePlayer(room, player);
    else this.afterDeparture(room);
  }

  private onDisconnect(socket: Sock) {
    const ctx = this.context(socket);
    if (!ctx) return;
    const { room, player } = ctx;
    player.socket = null;
    if (room.phase === 'lobby') {
      player.removeTimer = setTimeout(() => {
        if (!player.socket && room.players.get(player.id) === player) this.removePlayer(room, player);
      }, this.t.lobbyDisconnectMs);
    }
    this.afterDeparture(room);
  }

  private removePlayer(room: Room, player: Player) {
    if (player.removeTimer) clearTimeout(player.removeTimer);
    room.players.delete(player.id);
    if (room.players.size === 0) return this.deleteRoom(room);
    this.afterDeparture(room);
  }

  /** Common bookkeeping whenever someone disconnects or leaves. */
  private afterDeparture(room: Room) {
    if (!this.rooms.has(room.code)) return;
    const connected = [...room.players.values()].filter((p) => p.socket);
    if (connected.length === 0) {
      if (!room.emptyTimer) room.emptyTimer = setTimeout(() => this.deleteRoom(room), this.t.emptyRoomMs);
      return;
    }
    if (!room.players.get(room.hostId)?.socket) room.hostId = connected[0].id;

    if (
      room.phase === 'collecting' ||
      room.phase === 'question' ||
      room.phase === 'reveal' ||
      room.phase === 'leaderboard'
    ) {
      const inGame = connected.filter((p) => room.roster.includes(p.id));
      if (inGame.length < MIN_PLAYERS) {
        this.backToLobby(room, 'Not enough players left, so the game was stopped.');
        return;
      }
      if (room.phase === 'question') this.maybeEndQuestion(room);
    }
    this.broadcast(room);
  }

  private deleteRoom(room: Room) {
    this.clearTimer(room);
    if (room.emptyTimer) clearTimeout(room.emptyTimer);
    for (const p of room.players.values()) {
      if (p.removeTimer) clearTimeout(p.removeTimer);
      if (p.socket) {
        p.socket.emit('room:closed', { reason: 'The room was closed.' });
        void p.socket.leave(room.code);
        p.socket.data.code = undefined;
      }
    }
    this.dropPhotos(room);
    room.gameId++;
    this.rooms.delete(room.code);
  }

  private dropPhotos(room: Room) {
    for (const photo of room.photos) this.photoIndex.delete(photo.id);
    room.photos = [];
  }

  private clearTimer(room: Room) {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
  }

  private backToLobby(room: Room, notice: string | null) {
    this.clearTimer(room);
    this.dropPhotos(room);
    room.gameId++;
    room.phase = 'lobby';
    room.round = null;
    room.roster = [];
    room.notice = notice;
    for (const p of [...room.players.values()]) {
      p.score = 0;
      p.lastGain = 0;
      p.photosReady = false;
      if (!p.socket) room.players.delete(p.id);
    }
    if (room.players.size === 0) return this.deleteRoom(room);
    if (!room.players.has(room.hostId)) room.hostId = room.players.keys().next().value!;
    this.broadcast(room);
  }

  // ------------------------------------------------------------------- game

  private async startGame(room: Room) {
    const gameId = ++room.gameId;
    this.dropPhotos(room);
    room.phase = 'collecting';
    room.notice = null;
    room.round = null;
    const participants = [...room.players.values()].filter((p) => p.socket);
    room.roster = participants.map((p) => p.id);
    for (const p of room.players.values()) {
      p.score = 0;
      p.lastGain = 0;
      p.photosReady = false;
    }
    this.broadcast(room);

    const stale = () => room.gameId !== gameId || !this.rooms.has(room.code);
    const photos: Photo[] = [];
    const counts = distribute(room.rounds, room.roster);
    const fullyDelivered: string[] = [];
    await Promise.all(
      participants.map(async (p) => {
        const want = counts.get(p.id) ?? 0;
        const got = await this.requestPhotos(p, want);
        if (stale()) return;
        photos.push(...got);
        if (got.length >= want) fullyDelivered.push(p.id);
        p.photosReady = true;
        this.broadcast(room);
      }),
    );
    if (stale()) return;

    // Someone couldn't deliver (no photos, denied access, slow network):
    // ask the players who did deliver to cover the gap.
    const shortfall = room.rounds - photos.length;
    if (shortfall > 0 && fullyDelivered.length > 0) {
      const extra = distribute(shortfall, fullyDelivered);
      await Promise.all(
        fullyDelivered.map(async (id) => {
          const p = room.players.get(id);
          if (!p) return;
          const got = await this.requestPhotos(p, extra.get(id) ?? 0);
          if (!stale()) photos.push(...got);
        }),
      );
      if (stale()) return;
    }

    if (photos.length === 0) {
      this.backToLobby(room, "Couldn't get any photos from anyone's camera roll. Check photo access and try again.");
      return;
    }
    room.photos = orderPhotos(photos).slice(0, room.rounds);
    for (const photo of room.photos) this.photoIndex.set(photo.id, photo);
    this.startRound(room, 0);
  }

  private requestPhotos(player: Player, count: number): Promise<Photo[]> {
    const socket = player.socket;
    if (count <= 0 || !socket) return Promise.resolve([]);
    return new Promise((resolve) => {
      socket
        .timeout(this.t.collectTimeoutMs)
        .emit('photos:request', { count }, (err: Error | null, res: PhotoResponse) => {
          if (err || !res || !Array.isArray(res.photos)) return resolve([]);
          const out: Photo[] = [];
          for (const b64 of res.photos.slice(0, count)) {
            if (typeof b64 !== 'string') continue;
            const data = Buffer.from(b64.replace(/^data:[^,]*,/, ''), 'base64');
            const mime = sniffImage(data);
            if (!mime || data.length > MAX_PHOTO_BYTES) continue;
            out.push({ id: randomBytes(16).toString('hex'), ownerId: player.id, data, mime });
          }
          resolve(out);
        });
    });
  }

  private startRound(room: Room, index: number) {
    this.clearTimer(room);
    const now = Date.now();
    room.phase = 'question';
    room.round = {
      index,
      photo: room.photos[index],
      startedAt: now,
      deadline: now + this.t.answerMs + this.t.graceMs,
      answers: new Map(),
    };
    room.timer = setTimeout(() => this.endQuestion(room), this.t.answerMs + this.t.graceMs);
    this.broadcast(room);
  }

  private answer(room: Room, player: Player, p: { round: number; guessId: string; elapsedMs: number }): Ack {
    const round = room.round;
    if (room.phase !== 'question' || !round || p?.round !== round.index)
      return { ok: false, error: 'This round is over.' };
    if (!room.roster.includes(player.id)) return { ok: false, error: "You're not in this game." };
    if (round.photo.ownerId === player.id) return { ok: false, error: "That's your photo!" };
    if (round.answers.has(player.id)) return { ok: false, error: 'You already answered.' };
    if (!room.roster.includes(p.guessId)) return { ok: false, error: 'Unknown player.' };
    const now = Date.now();
    if (now > round.deadline) return { ok: false, error: 'Too late!' };

    // The client times from the moment the photo appeared on its screen,
    // which is fairer to slow connections; never trust it beyond what the
    // server actually observed.
    const serverMs = now - round.startedAt;
    const clientMs = Number(p.elapsedMs);
    const ms = Math.round(Number.isFinite(clientMs) ? Math.min(Math.max(clientMs, 0), serverMs) : serverMs);
    if (ms > this.t.answerMs) return { ok: false, error: 'Too late!' };
    const correct = p.guessId === round.photo.ownerId;
    round.answers.set(player.id, { guessId: p.guessId, correct, ms, points: scoreFor(correct, ms, this.t.answerMs) });
    if (!this.maybeEndQuestion(room)) this.broadcast(room);
    return { ok: true };
  }

  /** Ends the question early once everyone who can answer has. */
  private maybeEndQuestion(room: Room): boolean {
    const round = room.round;
    if (room.phase !== 'question' || !round) return false;
    const waitingOn = room.roster.filter(
      (id) => id !== round.photo.ownerId && room.players.get(id)?.socket && !round.answers.has(id),
    );
    if (waitingOn.length > 0) return false;
    // Let the last tap register visually before flipping to the reveal.
    this.clearTimer(room);
    room.timer = setTimeout(() => this.endQuestion(room), 400);
    return true;
  }

  private endQuestion(room: Room) {
    const round = room.round;
    if (room.phase !== 'question' || !round) return;
    this.clearTimer(room);
    for (const id of room.roster) {
      const player = room.players.get(id);
      if (!player) continue;
      const guess = round.answers.get(id);
      player.lastGain = guess?.points ?? 0;
      player.score += player.lastGain;
    }
    room.phase = 'reveal';
    this.broadcast(room);
    room.timer = setTimeout(() => {
      if (round.index + 1 >= room.photos.length) {
        room.phase = 'finished';
        room.timer = null;
        this.broadcast(room);
        return;
      }
      room.phase = 'leaderboard';
      this.broadcast(room);
      room.timer = setTimeout(() => this.startRound(room, round.index + 1), this.t.leaderboardMs);
    }, this.t.revealMs);
  }

  // -------------------------------------------------------------- snapshots

  private broadcast(room: Room) {
    for (const player of room.players.values()) {
      player.socket?.emit('room:state', this.snapshot(room, player));
    }
  }

  private snapshot(room: Room, viewer: Player): RoomState {
    const round = room.round;
    const revealed = room.phase === 'reveal' || room.phase === 'leaderboard' || room.phase === 'finished';
    const players: PublicPlayer[] = [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      lastGain: p.lastGain,
      connected: !!p.socket,
      isHost: p.id === room.hostId,
      photosReady: p.photosReady,
    }));
    const next = round ? room.photos[round.index + 1] : undefined;
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      settings: { rounds: room.rounds },
      players,
      round: round
        ? {
            index: round.index,
            total: room.photos.length,
            photoUrl: `/photos/${round.photo.id}`,
            choices: room.roster
              .map((id) => room.players.get(id))
              .filter((p): p is Player => !!p)
              .map((p) => ({ id: p.id, name: p.name, color: p.color })),
            answerMs: this.t.answerMs,
            deadline: round.deadline,
            answeredIds: [...round.answers.keys()],
            ownerId: revealed ? round.photo.ownerId : null,
            guesses: revealed ? Object.fromEntries(round.answers) : null,
          }
        : null,
      nextPhotoUrl: next && room.phase !== 'finished' ? `/photos/${next.id}` : null,
      serverNow: Date.now(),
      you: {
        id: viewer.id,
        isHost: viewer.id === room.hostId,
        ownsCurrentPhoto: !!round && round.photo.ownerId === viewer.id,
        guessId: round?.answers.get(viewer.id)?.guessId ?? null,
      },
      notice: room.notice,
    };
  }
}
