export const APP_URL = (import.meta.env.VITE_APP_URL ?? 'https://cafyz.ametronyx.com').replace(/\/$/, '');
export const TRIAL_DAYS = Number(import.meta.env.VITE_TRIAL_DAYS ?? 7);

export function appPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${APP_URL}${p}`;
}
