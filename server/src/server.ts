import { createServer, type Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { ClientToServer, ServerToClient } from '../../shared/protocol.ts';
import { DEFAULT_TIMINGS, GameServer, type Timings } from './game.ts';

export interface Started {
  http: HttpServer;
  game: GameServer;
  port: number;
  close: () => Promise<void>;
}

export function startServer(port: number, timings: Timings = DEFAULT_TIMINGS): Promise<Started> {
  let game: GameServer;

  const http = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const photo = url.pathname.match(/^\/photos\/([0-9a-f]{32})$/);
    if (photo && req.method === 'GET') {
      const found = game.getPhoto(photo[1]);
      if (!found) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': found.mime,
        'Content-Length': found.data.length,
        'Cache-Control': 'private, max-age=3600, immutable',
      });
      res.end(found.data);
      return;
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, name: 'photo-roulette', rooms: game.roomCount }));
      return;
    }

    res.writeHead(404).end();
  });

  const io = new Server<ClientToServer, ServerToClient>(http, {
    cors: { origin: '*' },
    // Photos are uploaded as base64 inside socket acks.
    maxHttpBufferSize: 40 * 1024 * 1024,
    pingInterval: 10000,
    pingTimeout: 8000,
  });
  game = new GameServer(io, timings);

  return new Promise((resolve) => {
    http.listen(port, () => {
      const address = http.address();
      resolve({
        http,
        game,
        port: typeof address === 'object' && address ? address.port : port,
        close: () => new Promise<void>((done) => io.close(() => done())),
      });
    });
  });
}
