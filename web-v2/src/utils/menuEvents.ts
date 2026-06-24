export const MENU_CHANGED_EVENT = 'CAFYZ_MENU_CHANGED';

export function notifyMenuChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MENU_CHANGED_EVENT));
}

export function subscribeMenuChanged(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(MENU_CHANGED_EVENT, handler);
  return () => window.removeEventListener(MENU_CHANGED_EVENT, handler);
}
