import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const MAX_SIDE = 1080;

/** Downscales an image and returns it as base64 JPEG, ready to upload. */
export async function encodeForUpload(uri: string, width?: number | null, height?: number | null): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  try {
    if (width && height) {
      if (Math.max(width, height) > MAX_SIDE) {
        context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
      }
    } else {
      context.resize({ width: MAX_SIDE });
    }
    const image = await context.renderAsync();
    try {
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!result.base64) throw new Error('Image could not be encoded');
      return result.base64.replace(/^data:[^,]*,/, '');
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
