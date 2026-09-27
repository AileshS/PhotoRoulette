import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_PORT = 3001;

/**
 * Where the game server lives.
 *
 * 1. `EXPO_PUBLIC_SERVER_URL` always wins (use this for a deployed server).
 * 2. On the web, the page's own host on the default port.
 * 3. In development, the machine running the Expo dev server — the same
 *    LAN address your phone already uses to load the app.
 */
function resolveServerUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_SERVER_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_PORT}`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${DEFAULT_PORT}`;

  return `http://localhost:${DEFAULT_PORT}`;
}

export const SERVER_URL = resolveServerUrl();

export function photoUrl(path: string): string {
  return path.startsWith('http') ? path : `${SERVER_URL}${path}`;
}
