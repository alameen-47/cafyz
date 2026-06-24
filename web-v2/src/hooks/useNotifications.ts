import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsApi, type ApiNotification } from '../services/api';
import { NOTIFICATIONS_REFRESH_EVENT } from '../utils/notificationEvents';

const POLL_MS = 30_000;

export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seenRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!enabled) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const data = await notificationsApi.list();
      if (!mountedRef.current) return;
      setItems(data.items);
      setUnread(data.unread);

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        for (const n of data.items) {
          if (n.read || seenRef.current.has(n.key)) continue;
          seenRef.current.add(n.key);
          try {
            new Notification(n.title, { body: n.body, tag: n.key });
          } catch { /* ignore */ }
        }
      } else {
        for (const n of data.items) seenRef.current.add(n.key);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      setError((e as Error).message || 'Could not load notifications');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setUnread(0);
      return;
    }
    seenRef.current = new Set();
    void load();
    const onRefresh = () => { void load(true); };
    window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
    window.addEventListener('CAFYZ_ORDER_SENT', onRefresh);
    window.addEventListener('CAFYZ_RESERVATION_CHANGED', onRefresh);
    const timer = window.setInterval(() => { void load(true); }, POLL_MS);
    return () => {
      window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, onRefresh);
      window.removeEventListener('CAFYZ_ORDER_SENT', onRefresh);
      window.removeEventListener('CAFYZ_RESERVATION_CHANGED', onRefresh);
      window.clearInterval(timer);
    };
  }, [enabled, load]);

  const markRead = useCallback(async (keys: string[]) => {
    const unreadRemoved = keys.filter(k => items.some(n => n.key === k && !n.read)).length;
    setItems(prev => prev.map(n => keys.includes(n.key) ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - unreadRemoved));
    try {
      await notificationsApi.markRead(keys);
      void load(true);
    } catch { /* keep optimistic UI */ }
  }, [items, load]);

  const markAllRead = useCallback(async () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
    try {
      await notificationsApi.markAllRead();
    } catch { /* ignore */ }
  }, []);

  const dismissLocal = useCallback((id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    items,
    unread,
    loading,
    error,
    refresh: () => load(true),
    markRead,
    markAllRead,
    dismissLocal,
  };
}
