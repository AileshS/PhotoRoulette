import { startServer } from './server.ts';

const port = Number(process.env.PORT) || 3001;
const { port: actual } = await startServer(port);
console.log(`📸 Photo Roulette server listening on http://0.0.0.0:${actual}`);
