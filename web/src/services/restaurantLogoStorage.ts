// Restaurant logos are stored on this device only (localStorage), keyed by
// restaurant id. Images are normalized for thermal receipt printing before save.

const PREFIX = 'cafyz_restaurant_logo_';
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PRINT_MAX_WIDTH = 384;
const PRINT_MAX_HEIGHT = 240;

export const RESTAURANT_LOGO_CHANGED = 'cafyz:restaurant-logo-changed';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;

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
      'Could not save logo on this device — storage may be full. Try a smaller PNG or JPG under 2 MB.',
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
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:')) resolve(result);
      else reject(new Error('Could not read image file.'));
    };
    reader.onerror = () => reject(new Error('Could not read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 1 || img.naturalHeight < 1) {
        reject(new Error('Image has no usable dimensions.'));
        return;
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error('Could not decode image. Use PNG or JPG (not HEIC).'));
    img.src = dataUrl;
  });
}

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) {
    // Browsers often cannot decode HEIC in canvas — steer users to PNG/JPG.
    if (/heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) return false;
    return true;
  }
  return IMAGE_EXT.test(file.name);
}

/** Resize/compress logo so thermal raster + localStorage stay reliable. */
export async function normalizeLogoForPrint(sourceDataUrl: string): Promise<string> {
  const img = await loadImageFromDataUrl(sourceDataUrl);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

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
  ctx.drawImage(img, 0, 0, targetW, targetH);

  let normalized = '';
  try {
    normalized = canvas.toDataURL('image/png');
  } catch {
    throw new Error('Could not process image. Try PNG or JPG.');
  }
  if (!normalized.startsWith('data:image/')) {
    throw new Error('Logo normalization failed.');
  }
  return normalized;
}

/** Instant preview URL while the file is being processed (caller must revoke). */
export function previewLogoFile(file: File): string {
  return URL.createObjectURL(file);
}

/** Reads an image file, normalizes it, saves on this device; returns the data URL. */
export async function saveRestaurantLogoFromFile(restaurantId: string, file: File): Promise<string> {
  if (!restaurantId) {
    throw new Error('Restaurant not loaded yet — wait a moment and try again.');
  }
  if (/heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
    throw new Error('iPhone HEIC photos are not supported. Save as PNG or JPG first.');
  }
  if (!isLikelyImageFile(file)) {
    throw new Error('Please choose a PNG, JPG, or WebP image.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Image is too large — use a file up to 2 MB.');
  }

  const raw = await readFileAsDataUrl(file);
  const dataUrl = await normalizeLogoForPrint(raw);

  if (dataUrl.length > 3_000_000) {
    throw new Error('Image is still too large after resize — try a simpler logo under 2 MB.');
  }

  setRestaurantLogo(restaurantId, dataUrl);

  // Verify round-trip so we never show “saved” when localStorage silently failed.
  const stored = getRestaurantLogo(restaurantId);
  if (stored !== dataUrl) {
    throw new Error('Logo did not persist on this device. Check browser storage is enabled.');
  }

  return dataUrl;
}
