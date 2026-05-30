// Restaurant logos: server DB is source of truth (restaurants.logo_url).
// localStorage caches the logo per device for fast printing offline.

import { colorLogoToPrintableDataUrl } from './logoThermalRaster';
import { restaurantApi } from './api';

const PREFIX = 'cafyz_restaurant_logo_';
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const RESTAURANT_LOGO_CHANGED = 'cafyz:restaurant-logo-changed';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;

function storageKey(restaurantId: string): string {
  return `${PREFIX}${restaurantId}`;
}

export function isValidLogoUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://');
}

/** Cached local copy, then server logo_url from the restaurant record. */
export function getRestaurantLogo(
  restaurantId: string | undefined | null,
  serverLogoUrl?: string | null,
): string | undefined {
  if (restaurantId) {
    try {
      const local = localStorage.getItem(storageKey(restaurantId));
      if (local && local.startsWith('data:image/')) return local;
    } catch {
      /* ignore */
    }
  }
  return isValidLogoUrl(serverLogoUrl) ? serverLogoUrl : undefined;
}

export function setRestaurantLogo(restaurantId: string, dataUrl: string): void {
  localStorage.setItem(storageKey(restaurantId), dataUrl);
  window.dispatchEvent(new CustomEvent(RESTAURANT_LOGO_CHANGED, { detail: { restaurantId } }));
}

export function clearRestaurantLogo(restaurantId: string): void {
  localStorage.removeItem(storageKey(restaurantId));
  window.dispatchEvent(new CustomEvent(RESTAURANT_LOGO_CHANGED, { detail: { restaurantId } }));
}

/** Pull logo from API into local cache (call after login / restaurantApi.me). */
export function syncRestaurantLogoCache(restaurant: { id: string; logo_url?: string | null }): void {
  if (!restaurant.id) return;
  if (isValidLogoUrl(restaurant.logo_url)) {
    try {
      setRestaurantLogo(restaurant.id, restaurant.logo_url);
    } catch {
      // localStorage full — getRestaurantLogo still falls back to serverLogoUrl
    }
  } else if (!restaurant.logo_url) {
    clearRestaurantLogo(restaurant.id);
  }
}

/** Fetch restaurant from API and refresh logo cache. */
export async function refreshRestaurantLogoFromServer(restaurantId: string): Promise<string | undefined> {
  const restaurant = await restaurantApi.me();
  if (restaurant.id !== restaurantId) return getRestaurantLogo(restaurantId, restaurant.logo_url);
  syncRestaurantLogoCache(restaurant);
  return getRestaurantLogo(restaurant.id, restaurant.logo_url);
}

export async function persistRestaurantLogo(restaurantId: string, dataUrl: string): Promise<void> {
  try {
    setRestaurantLogo(restaurantId, dataUrl);
  } catch {
    throw new Error(
      'Could not cache logo on this device — storage may be full. Try a smaller PNG or JPG under 2 MB.',
    );
  }
  await restaurantApi.update({ logo_url: dataUrl });
}

export async function removeRestaurantLogoEverywhere(restaurantId: string): Promise<void> {
  clearRestaurantLogo(restaurantId);
  await restaurantApi.update({ logo_url: '' });
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

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) {
    if (/heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) return false;
    return true;
  }
  return IMAGE_EXT.test(file.name);
}

export async function normalizeLogoForPrint(sourceDataUrl: string): Promise<string> {
  return colorLogoToPrintableDataUrl(sourceDataUrl);
}

export function previewLogoFile(file: File): string {
  return URL.createObjectURL(file);
}

/** Process image → dithered B&W, save to DB + device cache. */
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
    throw new Error('Image is still too large after processing — try a simpler logo under 2 MB.');
  }

  await persistRestaurantLogo(restaurantId, dataUrl);

  const stored = getRestaurantLogo(restaurantId, dataUrl);
  if (stored !== dataUrl) {
    throw new Error('Logo saved to server but could not be cached on this device.');
  }

  return dataUrl;
}
