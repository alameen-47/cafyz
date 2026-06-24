import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { notificationsApi } from '../services/api';
import { isNativeApp } from '../services/platformEnv';

const PUSH_TOKEN_KEY = 'cafyz_push_token';

async function requestWebNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
  }
}

export function usePushNotifications(enabled: boolean) {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    void requestWebNotificationPermission();

    if (!isNativeApp()) return;

    let removeListeners: (() => void) | undefined;
    let alive = true;

    void (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        const registerToken = async (token: string) => {
          if (!alive || !token || tokenRef.current === token) return;
          tokenRef.current = token;
          localStorage.setItem(PUSH_TOKEN_KEY, token);
          const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
          await notificationsApi.registerPushToken(token, platform);
        };

        const addListeners = await PushNotifications.addListener('registration', ev => {
          void registerToken(ev.value);
        });
        const errListener = await PushNotifications.addListener('registrationError', err => {
          console.warn('[push] registration error', err);
        });
        const recvListener = await PushNotifications.addListener('pushNotificationReceived', notification => {
          if (notification.title) {
            try {
              new Notification(notification.title, { body: notification.body ?? '' });
            } catch { /* foreground */ }
          }
          window.dispatchEvent(new Event('CAFYZ_NOTIFICATIONS_REFRESH'));
        });
        const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', () => {
          window.dispatchEvent(new Event('CAFYZ_NOTIFICATIONS_REFRESH'));
        });

        removeListeners = () => {
          void addListeners.remove();
          void errListener.remove();
          void recvListener.remove();
          void actionListener.remove();
        };

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();
      } catch (e) {
        console.warn('[push] setup skipped:', (e as Error).message);
      }
    })();

    return () => {
      alive = false;
      removeListeners?.();
      const token = tokenRef.current ?? localStorage.getItem(PUSH_TOKEN_KEY);
      if (token) {
        void notificationsApi.unregisterPushToken(token).catch(() => {});
        localStorage.removeItem(PUSH_TOKEN_KEY);
      }
    };
  }, [enabled]);
}
