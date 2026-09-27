// Web photo source. Browsers can't browse a camera roll, so the player picks
// a batch of photos once and the game draws randomly from that batch.
import * as ImagePicker from 'expo-image-picker';
import { encodeForUpload, shuffle } from './encode';

export type AccessStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

export const USES_PICKER = true;

interface Picked {
  uri: string;
  width: number;
  height: number;
}

let library: Picked[] = [];
const used = new Set<string>();

export async function checkAccess(): Promise<AccessStatus> {
  return library.length > 0 ? 'granted' : 'undetermined';
}

export async function requestAccess(): Promise<AccessStatus> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    quality: 1,
  });
  if (!result.canceled && result.assets.length > 0) {
    library = result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
    used.clear();
  }
  return library.length > 0 ? 'granted' : 'denied';
}

export function sourceSummary(): string | null {
  if (library.length === 0) return null;
  return `${library.length} photo${library.length === 1 ? '' : 's'} ready`;
}

export async function pickRandomPhotos(count: number): Promise<string[]> {
  if (count <= 0 || library.length === 0) return [];
  let fresh = library.filter((p) => !used.has(p.uri));
  if (fresh.length < count) {
    used.clear();
    fresh = library;
  }
  const out: string[] = [];
  for (const photo of shuffle(fresh)) {
    if (out.length >= count) break;
    try {
      out.push(await encodeForUpload(photo.uri, photo.width, photo.height));
      used.add(photo.uri);
    } catch {
      // Unreadable file; try the next one.
    }
  }
  return out;
}
