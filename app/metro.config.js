// Expo's dev server also forwards game traffic to the game server, so phones
// only ever need to reach one address. That address works on your Wi-Fi and
// through `npx expo start --tunnel`, which fixes the "Opening project" hang
// on networks and firewalls that block phones from reaching your computer.
const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const GAME_SERVER_PORT = Number(process.env.GAME_SERVER_PORT) || 3001;
const GAME_PATHS = /^\/(socket\.io|photos)\//;

const previous = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const base = previous ? previous(middleware, server) : middleware;
  return (req, res, next) => {
    if (!GAME_PATHS.test(req.url)) return base(req, res, next);
    const upstream = http.request(
      { host: '127.0.0.1', port: GAME_SERVER_PORT, path: req.url, method: req.method, headers: req.headers },
      (reply) => {
        res.writeHead(reply.statusCode ?? 502, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(
        `Photo Roulette game server isn't running on port ${GAME_SERVER_PORT}. Start everything with: npm run play`,
      );
    });
    req.pipe(upstream);
  };
};

module.exports = config;
