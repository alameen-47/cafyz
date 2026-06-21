import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

/** Only add top padding when the WebView actually draws under the status bar. */
export async function applyNativeSafeAreas() {
  if (!Capacitor.isNativePlatform()) return;

  const setTop = (px: number) => {
    document.documentElement.style.setProperty('--cap-status-bar-height', `${Math.max(0, Math.round(px))}px`);
  };

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    const info = await StatusBar.getInfo();
    // System already inset the WebView — no extra CSS gap needed.
    if (!info.overlays) {
      setTop(0);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    setTop((info.height ?? 0) * dpr);
  } catch {
    setTop(0);
  }
}

export function watchNativeSafeAreas() {
  if (!Capacitor.isNativePlatform()) return () => {};

  const refresh = () => { void applyNativeSafeAreas(); };
  refresh();
  window.addEventListener('resize', refresh);
  return () => window.removeEventListener('resize', refresh);
}
