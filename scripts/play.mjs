// Starts everything needed for a game night with one command:
//   1. the game server (port 3001)
//   2. the Expo dev server, which shows the QR code and forwards game
//      traffic to the game server (see app/metro.config.js)
//
//   npm run play        phones can be on any network (Expo tunnel)
//   npm run play:wifi   phones on the same Wi-Fi as this computer (faster)
//
// Tunnel mode uses Expo's WebSocket tunnel (@expo/ws-tunnel) rather than
// ngrok. It's plain JavaScript over HTTPS, so there's no ngrok.exe for
// antivirus to quarantine and it works on ARM PCs too. Expo only exposes it
// through EXPO_FORCE_WEBCONTAINER_ENV, and it only tunnels port 8081.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wifi = process.argv.includes('--wifi');
const gamePort = Number(process.env.PORT) || 3001;

const server = spawn(process.execPath, ['src/index.ts'], {
  cwd: join(root, 'server'),
  env: { ...process.env, PORT: String(gamePort) },
  stdio: ['ignore', 'inherit', 'inherit'],
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${gamePort}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`The game server didn't start on port ${gamePort}.`);
}

try {
  await waitForServer();
} catch (e) {
  console.error(`\n❌ ${e.message}`);
  server.kill();
  process.exit(1);
}

console.log(
  wifi
    ? '\n📶 Wi-Fi mode: every phone must be on the same Wi-Fi as this computer.\n'
    : '\n🌍 Tunnel mode: phones can be on any network. Give the tunnel a few seconds to connect.\n',
);

const expoArgs = ['expo', 'start', ...(wifi ? ['--lan'] : ['--tunnel', '--port', '8081'])];
const expoEnv = { ...process.env, GAME_SERVER_PORT: String(gamePort) };
if (!wifi) expoEnv.EXPO_FORCE_WEBCONTAINER_ENV = '1';

// Windows needs a shell to find npx.cmd; pass one command string so Node
// doesn't warn about unescaped arguments (DEP0190).
const expo =
  process.platform === 'win32'
    ? spawn(`npx ${expoArgs.join(' ')}`, { cwd: join(root, 'app'), env: expoEnv, stdio: 'inherit', shell: true })
    : spawn('npx', expoArgs, { cwd: join(root, 'app'), env: expoEnv, stdio: 'inherit' });

const stop = () => {
  server.kill();
  expo.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
expo.on('exit', (code) => {
  server.kill();
  process.exit(code ?? 0);
});
server.on('exit', (code) => {
  if (code) console.error(`\n❌ The game server stopped (exit code ${code}).`);
  expo.kill();
});
