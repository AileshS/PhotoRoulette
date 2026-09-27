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
//
// Expo Go (SDK 57+) on a physical iPhone only opens a project when Expo Go and
// this computer are signed in to the same Expo account, so we check the
// computer's login first and offer to sign in.
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wifi = process.argv.includes('--wifi');
const gamePort = Number(process.env.PORT) || 3001;
const appDir = join(root, 'app');

// Windows needs a shell to find npx.cmd; pass one command string so Node
// doesn't warn about unescaped arguments (DEP0190).
function npx(args, options) {
  return process.platform === 'win32'
    ? spawn(`npx ${args.join(' ')}`, { ...options, shell: true })
    : spawn('npx', args, options);
}

function expoAccount() {
  const options = { cwd: appDir, encoding: 'utf8' };
  const res =
    process.platform === 'win32'
      ? spawnSync('npx expo whoami', { ...options, shell: true })
      : spawnSync('npx', ['expo', 'whoami'], options);
  const name = res.stdout?.trim().split('\n').pop();
  return res.status === 0 && name ? name : null;
}

let account = expoAccount();
if (!account) {
  console.log(
    '\n🔑 iPhones only open the game when Expo Go and this computer are signed in to the same Expo account.' +
      '\n   Sign in below (create a free account at https://expo.dev/signup if you need one).\n',
  );
  const login = npx(['expo', 'login'], { cwd: appDir, stdio: 'inherit' });
  await new Promise((resolve) => login.on('exit', resolve));
  account = expoAccount();
  if (!account) {
    console.error('\n❌ Not signed in to Expo. Run `npm run play` again to retry.');
    process.exit(1);
  }
}
console.log(`\n👤 Signed in to Expo as "${account}". Every iPhone must sign in to Expo Go as "${account}" too.`);

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

const expo = npx(expoArgs, { cwd: appDir, env: expoEnv, stdio: 'inherit' });

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
