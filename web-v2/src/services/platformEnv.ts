/** Detect Capacitor native shell vs browser vs Electron desktop. */

import { Capacitor } from '@capacitor/core';

export type AppRuntime = 'web' | 'capacitor' | 'electron';

export function getAppRuntime(): AppRuntime {
  if (typeof window !== 'undefined' && (window as Window & { cafyzElectron?: boolean }).cafyzElectron) {
    return 'electron';
  }
  if (Capacitor.isNativePlatform()) return 'capacitor';
  return 'web';
}

export function isNativeApp(): boolean {
  return getAppRuntime() === 'capacitor';
}

export function isElectronApp(): boolean {
  return getAppRuntime() === 'electron';
}

export function isDesktopShell(): boolean {
  const r = getAppRuntime();
  return r === 'electron' || (r === 'web' && getPrinterPlatformFromUA() === 'desktop');
}

/** True when FCM/APNs native config files exist (google-services.json / GoogleService-Info.plist). */
export function isNativePushAvailable(): boolean {
  try {
    // Injected at build time by vite.config.ts (capacitor mode).
    if (typeof __CAFYZ_NATIVE_PUSH__ === 'boolean') return __CAFYZ_NATIVE_PUSH__;
  } catch {
    /* web bundle — global not defined */
  }
  const flag = String((import.meta as any).env?.VITE_NATIVE_PUSH_ENABLED ?? '').toLowerCase();
  return flag === 'true' || flag === '1';
}

function getPrinterPlatformFromUA(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  if (/Windows|Macintosh|Linux/i.test(ua) && !/Android|iPhone|iPad/i.test(ua)) return 'desktop';
  return 'unknown';
}
