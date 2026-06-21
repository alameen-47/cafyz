import { menuApi } from './api';
import { validateMenuImageFile } from '../utils/menuImage';

const MAX_DATA_URL_CHARS = 3_000_000;

function isCloudinaryUnavailableError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('cloudinary') || m.includes('not configured') || m.includes('503')
    || m.includes('image upload is not configured');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:image/')) resolve(result);
      else reject(new Error('Could not read image file.'));
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

/** Upload to Cloudinary when configured; otherwise store as data URL in the DB (local dev). */
export async function uploadMenuItemImage(file: File): Promise<string> {
  const validation = validateMenuImageFile(file);
  if (validation) throw new Error(validation);

  try {
    const { url } = await menuApi.uploadImage(file);
    return url;
  } catch (e) {
    const msg = (e as Error).message;
    if (!isCloudinaryUnavailableError(msg)) throw e;
    const dataUrl = await readFileAsDataUrl(file);
    if (dataUrl.length > MAX_DATA_URL_CHARS) {
      throw new Error('Image is too large after encoding — try a smaller photo under 2 MB.');
    }
    return dataUrl;
  }
}
