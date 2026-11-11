import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

/** `light` content is white text and icons, for dark tops; `dark` content is the reverse. */
export interface StatusBarLook {
  content: 'light' | 'dark';
  color: string;
}

let override: StatusBarLook | null = null;

function themeLook(): StatusBarLook {
  const root = document.documentElement;
  if (!root.classList.contains('dark')) return { content: 'dark', color: '#f4f2fb' };
  // Signed in, the bar takes the chosen theme's ground; the sign-in screen keeps its own.
  const ground = root.hasAttribute('data-signed-in')
    ? getComputedStyle(root).getPropertyValue('--cafyz-app-bg').trim()
    : '';
  return { content: 'light', color: /^#[0-9a-f]{6}$/i.test(ground) ? ground : '#070511' };
}

/**
 * Paint the phone's status bar (native) and the browser's theme colour (web)
 * for whatever is on screen: the theme by default, or a screen's own top colour.
 */
export function applyStatusBarLook(): void {
  const look = override ?? themeLook();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', look.color);
  if (!Capacitor.isNativePlatform()) return;
  // Capacitor names styles by background: Style.Dark means light text.
  void StatusBar.setStyle({ style: look.content === 'light' ? Style.Dark : Style.Light }).catch(() => {});
  void StatusBar.setBackgroundColor({ color: look.color }).catch(() => {});
}

/** A screen whose top is its own colour (the sign-in photo) sets this while shown; null goes back to the theme. */
export function setStatusBarOverride(look: StatusBarLook | null): void {
  override = look;
  applyStatusBarLook();
}
