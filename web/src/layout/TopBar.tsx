import { useEffect, useMemo, useRef, useState } from 'react';
import './TopBar.css';

export interface TopBarNotification {
  id: string;
  title: string;
  message: string;
  tone?: 'info' | 'warning' | 'success' | 'danger';
  href?: string;
  ts?: number;
}

interface TopBarProps {
  crumb: [string, string];
  cover?: string;
  right?: React.ReactNode;
  onMenuClick?: () => void;
  menuOpen?: boolean;
  onSupportClick?: () => void;
  supportOpen?: boolean;
  onProfileClick?: () => void;
  profileOpen?: boolean;
  notifications?: TopBarNotification[];
  notificationsOpen?: boolean;
  unreadCount?: number;
  onToggleNotifications?: () => void;
  onCloseNotifications?: () => void;
  onOpenNotification?: (notification: TopBarNotification) => void;
  onMarkAllNotificationsRead?: () => void;
}

export function TopBar({
  crumb,
  cover = 'Service · Dinner',
  right,
  onMenuClick,
  menuOpen = false,
  onSupportClick,
  supportOpen = false,
  onProfileClick,
  profileOpen = false,
  notifications = [],
  notificationsOpen = false,
  unreadCount = 0,
  onToggleNotifications,
  onCloseNotifications,
  onOpenNotification,
  onMarkAllNotificationsRead,
}: TopBarProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const liveClock = useMemo(
    () => {
      const fmt = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const parts = Object.fromEntries(
        fmt.formatToParts(now).map((p) => [p.type, p.value]),
      );
      return {
        hh: parts.hour ?? '12',
        mm: parts.minute ?? '00',
        ss: parts.second ?? '00',
        ampm: String(parts.dayPeriod ?? 'AM').toUpperCase(),
      };
    },
    [now],
  );
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointer = (e: MouseEvent) => {
      const node = notifRef.current;
      if (!node || node.contains(e.target as Node)) return;
      onCloseNotifications?.();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseNotifications?.();
    };
    window.addEventListener('mousedown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [notificationsOpen, onCloseNotifications]);

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-menu-btn"
        onClick={onMenuClick}
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
      >
        <span className="topbar-menu-icon" aria-hidden />
      </button>
      <div className="topbar-crumb">
        <span className="topbar-crumb-parent">{crumb[0]}</span>
        <span className="topbar-crumb-sep">›</span>
        <span className="topbar-crumb-current">{crumb[1]}</span>
      </div>
      <div className="topbar-pill">
        <span className="topbar-dot" />
        <span>{cover}</span>
        <span className="topbar-sep">·</span>
        <span className="mono topbar-clock">
          <span>{liveClock.hh}</span>
          <span className="topbar-clock-sep">:</span>
          <span>{liveClock.mm}</span>
          <span className="topbar-clock-sep topbar-clock-sep-blink">:</span>
          <span className="topbar-clock-sec">{liveClock.ss}</span>
          <span className="topbar-clock-ampm">{liveClock.ampm}</span>
        </span>
      </div>
      <div className="topbar-actions">
        {right}
        <button
          type="button"
          className={`topbar-support ${supportOpen ? 'active' : ''}`}
          onClick={onSupportClick}
          aria-label={supportOpen ? 'Close AI customer support' : 'Open AI customer support'}
          title="AI Customer Support"
        >
          🎧 AI
        </button>
        <button
          type="button"
          className={`topbar-support ${profileOpen ? 'active' : ''}`}
          onClick={onProfileClick}
          aria-label={profileOpen ? 'Close profile settings' : 'Open profile settings'}
          title="My Profile"
        >
          👤
        </button>
        <div className="topbar-notif-wrap" ref={notifRef}>
          <button
            type="button"
            className={`topbar-bell ${notificationsOpen ? 'active' : ''}`}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={onToggleNotifications}
          >
            🔔
            {unreadCount > 0 && (
              <span className="topbar-notif-dot">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="topbar-notif-panel" role="dialog" aria-label="Notifications">
              <div className="topbar-notif-head">
                <p>Notifications</p>
                <button type="button" onClick={onMarkAllNotificationsRead}>
                  Mark all read
                </button>
              </div>
              <div className="topbar-notif-list">
                {notifications.length === 0 ? (
                  <p className="topbar-notif-empty">No new notifications for this panel.</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className={`topbar-notif-item tone-${n.tone ?? 'info'}`}
                      onClick={() => onOpenNotification?.(n)}
                    >
                      <span className="topbar-notif-item-title">{n.title}</span>
                      <span className="topbar-notif-item-msg">{n.message}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
