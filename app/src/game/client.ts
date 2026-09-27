import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServer, RoomState, ServerToClient } from '../../../shared/protocol';
import { SERVER_URL } from '../config';
import { pickRandomPhotos } from '../photos/photoSource';

export type ConnectionStatus = 'offline' | 'connecting' | 'online';

export interface GameSnapshot {
  name: string;
  status: ConnectionStatus;
  room: RoomState | null;
  /** serverNow - Date.now(), to line countdowns up with the server. */
  clockOffset: number;
  /** True while this phone is picking and uploading its photos. */
  sharingPhotos: boolean;
  /** Set when we were dropped from a room (it closed, or rejoining failed). */
  kicked: string | null;
}

const CONNECT_TIMEOUT_MS = 8000;

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

class GameClient {
  private socket: Socket<ServerToClient, ClientToServer> | null = null;
  private listeners = new Set<() => void>();
  private roomCode: string | null = null;
  /** True between asking to create/join a room and hearing back. */
  private entering = false;
  readonly playerId = randomId();

  private snapshot: GameSnapshot = {
    name: '',
    status: 'offline',
    room: null,
    clockOffset: 0,
    sharingPhotos: false,
    kicked: null,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<GameSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  setName(name: string) {
    this.set({ name });
  }

  private ensureSocket() {
    if (this.socket) return this.socket;
    const socket: Socket<ServerToClient, ClientToServer> = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });

    socket.on('connect', () => {
      this.set({ status: 'online' });
      // After a drop (app backgrounded, network switch) slip back into our room.
      if (this.roomCode) {
        socket.emit('room:join', { code: this.roomCode, name: this.snapshot.name, playerId: this.playerId }, (r) => {
          if (!r.ok) this.dropRoom(r.error);
        });
      }
    });
    socket.on('disconnect', () => this.set({ status: this.roomCode ? 'connecting' : 'offline' }));
    socket.io.on('reconnect_attempt', () => this.set({ status: 'connecting' }));

    socket.on('room:state', (room) => {
      // The first state can arrive before our create/join ack has been processed.
      if (this.entering && !this.roomCode) this.roomCode = room.code;
      if (!this.roomCode || room.code !== this.roomCode) return;
      this.set({ room, clockOffset: room.serverNow - Date.now() });
    });

    socket.on('room:closed', ({ reason }) => this.dropRoom(reason));

    socket.on('photos:request', async ({ count }, ack) => {
      this.set({ sharingPhotos: true });
      try {
        ack({ photos: await pickRandomPhotos(count) });
      } catch (e) {
        console.warn('Could not read photos', e);
        ack({ photos: [] });
      } finally {
        this.set({ sharingPhotos: false });
      }
    });

    this.socket = socket;
    return socket;
  }

  private connected(): Promise<Socket<ServerToClient, ClientToServer>> {
    const socket = this.ensureSocket();
    if (socket.connected) return Promise.resolve(socket);
    this.set({ status: 'connecting' });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        this.set({ status: 'offline' });
        reject(new Error(`Can't reach the game server at ${SERVER_URL}.`));
      }, CONNECT_TIMEOUT_MS);
      const onConnect = () => {
        cleanup();
        resolve(socket);
      };
      const cleanup = () => {
        clearTimeout(timer);
        socket.off('connect', onConnect);
      };
      socket.on('connect', onConnect);
      socket.connect();
    });
  }

  private dropRoom(reason: string | null) {
    this.roomCode = null;
    this.set({ room: null, kicked: reason });
  }

  clearKicked() {
    this.set({ kicked: null });
  }

  private async enter(event: 'room:create' | 'room:join', payload: { code?: string }): Promise<Ack<{ code: string }>> {
    this.entering = true;
    try {
      const socket = await this.connected();
      const base = { name: this.snapshot.name, playerId: this.playerId };
      const res =
        event === 'room:create'
          ? await socket.timeout(CONNECT_TIMEOUT_MS).emitWithAck('room:create', base)
          : await socket.timeout(CONNECT_TIMEOUT_MS).emitWithAck('room:join', { ...base, code: payload.code ?? '' });
      if (res.ok) {
        this.roomCode = res.code;
        this.set({ kicked: null });
      }
      return res;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Something went wrong.' };
    } finally {
      this.entering = false;
    }
  }

  createRoom() {
    return this.enter('room:create', {});
  }

  joinRoom(code: string) {
    return this.enter('room:join', { code });
  }

  leaveRoom() {
    this.socket?.emit('room:leave');
    this.dropRoom(null);
  }

  setRounds(rounds: number) {
    this.socket?.emit('game:settings', { rounds });
  }

  async startGame(): Promise<Ack> {
    if (!this.socket) return { ok: false, error: 'Not connected.' };
    try {
      return await this.socket.timeout(CONNECT_TIMEOUT_MS).emitWithAck('game:start');
    } catch {
      return { ok: false, error: 'The server did not respond.' };
    }
  }

  playAgain() {
    this.socket?.emit('game:again');
  }

  async answer(round: number, guessId: string, elapsedMs: number): Promise<Ack> {
    if (!this.socket) return { ok: false, error: 'Not connected.' };
    try {
      return await this.socket.timeout(4000).emitWithAck('round:answer', { round, guessId, elapsedMs });
    } catch {
      return { ok: false, error: 'The server did not respond.' };
    }
  }
}

export const game = new GameClient();

export function useGame(): GameSnapshot {
  return useSyncExternalStore(game.subscribe, game.getSnapshot, game.getSnapshot);
}
