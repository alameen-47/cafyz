// Restaurant logos are stored on this device only (localStorage), keyed by
// restaurant id. Images are normalized for thermal receipt printing (max width,
// PNG) before save.

const PREFIX = 'cafyz_restaurant_logo_';
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
/** Dots — 58mm printers ≈ 384, 80mm ≈ 576; we target 58mm compatibility */
const PRINT_MAX_WIDTH = 384;
const PRINT_MAX_HEIGHT = 240;

export const RESTAURANT_LOGO_CHANGED = 'cafyz:restaurant-logo-changed';

function storageKey(restaurantId: string): string {
  return `${PREFIX}${restaurantId}`;
}

export function getRestaurantLogo(restaurantId: string | undefined | null): string | undefined {
  if (!restaurantId) return undefined;
  try {
    const v = localStorage.getItem(storageKey(restaurantId));
    return v && v.startsWith('data:image/') ? v : undefined;
  } catch {
    return undefined;
  }
}

export function setRestaurantLogo(restaurantId: string, dataUrl: string): void {
  try {
    localStorage.setItem(storageKey(restaurantId), dataUrl);
    window.dispatchEvent(new CustomEvent(RESTAURANT_LOGO_CHANGED, { detail: { restaurantId } }));
  } catch {
    throw new Error(
      'Could not save logo on this device — the image may be too large. Try a smaller PNG under 500 KB.',
    );
  }
}

export function clearRestaurantLogo(restaurantId: string): void {
  localStorage.removeItem(storageKey(restaurantId));
  window.dispatchEvent(new CustomEvent(RESTAURANT_LOGO_CHANGED, { detail: { restaurantId } }));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

/** Resize/compress logo so thermal raster + localStorage stay reliable. */
export async function normalizeLogoForPrint(sourceDataUrl: string): Promise<string> {
  const bitmap = await decodeToImageBitmap(sourceDataUrl);
  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (srcW < 1 || srcH < 1) {
      throw new Error('Image has no usable dimensions.');
    }

    const scale = Math.min(1, PRINT_MAX_WIDTH / srcW, PRINT_MAX_HEIGHT / srcH);
    const targetW = Math.max(1, Math.round(srcW * scale));
    const targetH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare logo canvas.');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const normalized = canvas.toDataURL('image/png');
    if (!normalized.startsWith('data:image/')) {
      throw new Error('Logo normalization failed.');
    }
    return normalized;
  } finally {
    bitmap.close();
  }
}

async function decodeToImageBitmap(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('Invalid image file.');
  }
  return createImageBitmap(blob);
}

/** Reads an image file, normalizes it, saves on this device; returns the data URL. */
export async function saveRestaurantLogoFromFile(restaurantId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, or WebP).');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Image is too large — use a file under 1.5 MB.');
  }
  const raw = await readFileAsDataUrl(file);
  const dataUrl = await normalizeLogoForPrint(raw);
  if (dataUrl.length > 2_500_000) {
    throw new Error('Image is still too large after resize — try a simpler logo under 500 KB.');
  }
  setRestaurantLogo(restaurantId, dataUrl);
  return dataUrl;
}
