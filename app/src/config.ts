import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 3001;

interface ServerTarget {
  url: string;
  /**
   * True when game traffic goes through the Expo dev server's proxy
   * (see metro.config.js). That proxy can't carry WebSockets, so the
   * connection sticks to HTTP long-polling.
   */
  viaDevProxy: boolean;
}

/**
 * Where the game server lives.
 *
 * 1. `EXPO_PUBLIC_SERVER_URL` always wins (use this for a deployed server).
 * 2. In development, the Expo dev server itself, which forwards game traffic
 *    to the game server. That's the address the phone already used to load
 *    the app, so it works on Wi-Fi and through `--tunnel` alike.
 * 3. A production web build: the page's own host on the default port.
 */
function resolveServer(): ServerTarget {
  const fromEnv = process.env.EXPO_PUBLIC_SERVER_URL;
  if (fromEnv) return { url: fromEnv.replace(/\/+$/, ''), viaDevProxy: false };

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (__DEV__) return { url: window.location.origin, viaDevProxy: true };
    return { url: `${window.location.protocol}//${window.location.hostname}:${DEFAULT_PORT}`, viaDevProxy: false };
  }

  // "192.168.1.20:8081" on Wi-Fi, or "<something>.exp.direct" (HTTPS, no port) through a tunnel.
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const hasPort = /:\d+$/.test(hostUri);
    return { url: `${hasPort ? 'http' : 'https'}://${hostUri}`, viaDevProxy: true };
  }

  return { url: `http://localhost:${DEFAULT_PORT}`, viaDevProxy: false };
}

const server = resolveServer();

export const SERVER_URL = server.url;
export const SERVER_VIA_DEV_PROXY = server.viaDevProxy;

export function photoUrl(path: string): string {
  return path.startsWith('http') ? path : `${SERVER_URL}${path}`;
}
