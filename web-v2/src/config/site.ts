import { Capacitor } from '@capacitor/core';

const ENV = (import.meta as { env?: Record<string, string> }).env ?? {};

/** Public web origin for customer-facing links (QR menu, share URLs). */
export function resolveAppUrl(): string {
  const fromEnv = String(ENV.VITE_APP_URL ?? '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  if (typeof window !== 'undefined') {
    const { protocol, host } = window.location;
    // Native Capacitor serves from https://localhost — not scannable for customers.
    if (!Capacitor.isNativePlatform() && host) {
      return `${protocol}//${host}`;
    }
  }

  return 'https://cafyz.ametronyx.com';
}

/** Stable customer menu URL for this restaurant (slug preferred, id fallback). */
export function getPublicMenuUrl(slugOrId: string): string {
  const id = slugOrId.trim();
  if (!id) return '';
  return `${resolveAppUrl()}/m/${encodeURIComponent(id)}`;
}

export function getPublicMenuIdentifier(slug?: string | null, restaurantId?: string | null): string {
  return (slug?.trim() || restaurantId?.trim() || '');
}
