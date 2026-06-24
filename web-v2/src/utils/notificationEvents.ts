export const NOTIFICATIONS_REFRESH_EVENT = 'CAFYZ_NOTIFICATIONS_REFRESH';

export function notifyNotificationsRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_REFRESH_EVENT));
}
