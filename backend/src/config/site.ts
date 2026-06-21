/** Public web app origin (no trailing slash). */
export const APP_URL = (process.env.APP_URL ?? 'https://cafyz.ametronyx.com').replace(/\/$/, '');

/** Password-reset deep link for the web-v2 SPA (?mode=reset&token=…). */
export function resetPasswordUrl(token: string): string {
  return `${APP_URL}/?mode=reset&token=${encodeURIComponent(token)}`;
}

export const TRIAL_DAYS = Number(process.env.TRIAL_DAYS ?? 7);

// Anti-abuse: how long before the same device/IP can request again
export const TRIAL_REQUEST_COOLDOWN_DAYS = Number(process.env.TRIAL_REQUEST_COOLDOWN_DAYS ?? 30);

export function appPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${APP_URL}${p}`;
}

export function trialEndsAt(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + TRIAL_DAYS);
  return d.toISOString();
}

export function trialEndsDateLabel(from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + TRIAL_DAYS);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
