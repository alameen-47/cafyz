import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * localStorage access that never throws (private mode, WebView quota, etc.).
 *
 * On iOS and Android the sign-in is also mirrored to native app storage: the OS may clear a
 * WebView's localStorage (low storage, WebKit data eviction), which would sign staff out.
 */

const DURABLE_KEYS = new Set(['cafyz_token', 'cafyz_user']);
const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): boolean {
  if (DURABLE_KEYS.has(key) && isNative()) void Preferences.set({ key, value }).catch(() => {});
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key: string): void {
  if (DURABLE_KEYS.has(key) && isNative()) void Preferences.remove({ key }).catch(() => {});
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Run once before the app renders on iOS/Android: bring back a sign-in the OS wiped from
 * localStorage, and copy an existing localStorage sign-in into native storage.
 */
export async function hydrateDurableStorage(): Promise<void> {
  if (!isNative()) return;
  await Promise.all(Array.from(DURABLE_KEYS).map(async key => {
    try {
      const { value } = await Preferences.get({ key });
      const local = storageGet(key);
      if (value && !local) localStorage.setItem(key, value);
      else if (local && value !== local) await Preferences.set({ key, value: local });
    } catch {
      /* native storage unavailable — localStorage still works */
    }
  }));
}
