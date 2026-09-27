// Native (iOS / Android) photo source: random picks from the real camera roll.
// The web build uses photoSource.web.ts instead.
import {
  MediaType,
  SortBy,
  getAssetInfoAsync,
  getAssetsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  type Asset,
  type PermissionResponse,
} from 'expo-media-library';
import { encodeForUpload, shuffle } from './encode';

export type AccessStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

/** On native the OS permission prompt *is* the camera-roll step. */
export const USES_PICKER = false;

/** Only the most recent photos are considered, to keep the lookup fast on huge libraries. */
const POOL_LIMIT = 5000;

/** Photos already shown this session, so the same one doesn't come up twice. */
const used = new Set<string>();

function toStatus(p: PermissionResponse): AccessStatus {
  if (p.granted) return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return p.canAskAgain ? 'denied' : 'blocked';
}

export async function checkAccess(): Promise<AccessStatus> {
  try {
    return toStatus(await getPermissionsAsync(false, ['photo']));
  } catch {
    return 'undetermined';
  }
}

export async function requestAccess(): Promise<AccessStatus> {
  return toStatus(await requestPermissionsAsync(false, ['photo']));
}

export function sourceSummary(): string | null {
  return null;
}

async function loadPool(): Promise<Asset[]> {
  const page = await getAssetsAsync({
    mediaType: MediaType.photo,
    sortBy: [[SortBy.creationTime, false]],
    first: POOL_LIMIT,
  });
  return page.assets;
}

async function encodeAsset(asset: Asset): Promise<string> {
  // On iOS `asset.uri` is a ph:// reference; localUri is a readable file
  // (downloaded from iCloud first if the original isn't on the phone).
  const info = await getAssetInfoAsync(asset);
  return encodeForUpload(info.localUri ?? asset.uri, asset.width, asset.height);
}

/** Picks `count` random photos from the camera roll and returns them as base64 JPEGs. */
export async function pickRandomPhotos(count: number): Promise<string[]> {
  if (count <= 0) return [];
  const pool = await loadPool();
  if (pool.length === 0) return [];
  let fresh = pool.filter((a) => !used.has(a.id));
  if (fresh.length < count) {
    // Small library and lots of games: allow repeats rather than coming up short.
    used.clear();
    fresh = pool;
  }

  const out: string[] = [];
  // Some assets can't be read (e.g. iCloud-only originals); skip them and try others.
  const candidates = shuffle(fresh).slice(0, count * 3);
  for (let i = 0; i < candidates.length && out.length < count; i += 3) {
    const batch = candidates.slice(i, i + Math.min(3, count - out.length));
    const results = await Promise.allSettled(batch.map(encodeAsset));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled' && out.length < count) {
        out.push(r.value);
        used.add(batch[j].id);
      }
    });
  }
  return out;
}
