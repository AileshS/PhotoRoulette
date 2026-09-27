// Types shared by the game server and the mobile app.
// Type-only on purpose: both sides import it with `import type`, so it never
// has to be bundled or resolved at runtime.

export type Phase =
  | 'lobby'
  | 'collecting' // gathering random photos from every player's camera roll
  | 'question' // photo on screen, players are guessing
  | 'reveal' // owner revealed, per-player results shown
  | 'leaderboard' // standings between rounds
  | 'finished'; // final podium

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  /** Points earned in the most recently revealed round. */
  lastGain: number;
  connected: boolean;
  isHost: boolean;
  /** Only meaningful while collecting photos. */
  photosReady: boolean;
}

export interface Guess {
  guessId: string;
  correct: boolean;
  points: number;
  ms: number;
}

export interface RoundState {
  /** 0-based index of the current round. */
  index: number;
  total: number;
  photoUrl: string;
  /** Everyone who is in the game, in a stable order. */
  choices: { id: string; name: string; color: string }[];
  answerMs: number;
  /** Server epoch ms when guessing closes (includes a small grace period). */
  deadline: number;
  answeredIds: string[];
  /** Filled in once the round is revealed. */
  ownerId: string | null;
  guesses: Record<string, Guess> | null;
}

export interface RoomState {
  code: string;
  phase: Phase;
  hostId: string;
  settings: { rounds: number };
  players: PublicPlayer[];
  round: RoundState | null;
  /** Photo for the next round so clients can preload it during the leaderboard. */
  nextPhotoUrl: string | null;
  /** Server clock at the time this snapshot was sent. */
  serverNow: number;
  /** Personalised per recipient. */
  you: { id: string; isHost: boolean; ownsCurrentPhoto: boolean; guessId: string | null };
  /** Human-readable message for the whole room (e.g. why a game was cancelled). */
  notice: string | null;
}

export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export interface ClientToServer {
  'room:create': (p: { name: string; playerId: string }, ack: (r: Ack<{ code: string }>) => void) => void;
  'room:join': (p: { code: string; name: string; playerId: string }, ack: (r: Ack<{ code: string }>) => void) => void;
  'room:leave': () => void;
  'game:settings': (p: { rounds: number }) => void;
  'game:start': (ack: (r: Ack) => void) => void;
  'game:again': () => void;
  'round:answer': (p: { round: number; guessId: string; elapsedMs: number }, ack: (r: Ack) => void) => void;
}

export interface PhotoRequest {
  count: number;
}

export interface PhotoResponse {
  /** Base64-encoded JPEG images (no data: prefix). */
  photos: string[];
}

export interface ServerToClient {
  'room:state': (s: RoomState) => void;
  'room:closed': (p: { reason: string }) => void;
  'photos:request': (p: PhotoRequest, ack: (r: PhotoResponse) => void) => void;
}
