// Restaurant logos are stored on this device only (localStorage), keyed by
// restaurant id. They are not synced to the server or other browsers.

const PREFIX = 'cafyz_restaurant_logo_';
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;

export const RESTAURANT_LOGO_CHANGED = 'cafyz:restaurant-logo-changed';

function storageKey(restaurantId: string): string {
  return `${PREFIX}${restaurantId}`;
}

export function getRestaurantLogo(restaurantId: string | undefined | null): string | undefined {
  if (!restaurantId) return undefined;
  try {
    return localStorage.getItem(storageKey(restaurantId)) || undefined;
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
      'Could not save logo on this device — the image may be too large. Try a smaller PNG under 1 MB.',
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

/** Reads an image file and saves it on this device; returns the data URL. */
export async function saveRestaurantLogoFromFile(restaurantId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPG, or WebP).');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Image is too large — use a file under 1.5 MB.');
  }
  const dataUrl = await readFileAsDataUrl(file);
  if (dataUrl.length > 2_500_000) {
    throw new Error('Image is too large for this browser — try a smaller file.');
  }
  setRestaurantLogo(restaurantId, dataUrl);
  return dataUrl;
}
