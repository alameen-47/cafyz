import { useEffect, useMemo, useState } from 'react';
import './TopBar.css';

interface TopBarProps {
  crumb: [string, string];
  cover?: string;
  right?: React.ReactNode;
  onMenuClick?: () => void;
  menuOpen?: boolean;
  onSupportClick?: () => void;
  supportOpen?: boolean;
}

export function TopBar({
  crumb,
  cover = 'Service · Dinner',
  right,
  onMenuClick,
  menuOpen = false,
  onSupportClick,
  supportOpen = false,
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
        <button type="button" className="topbar-bell" aria-label="Notifications">
          🔔
          <span className="topbar-notif-dot" />
        </button>
      </div>
    </header>
  );
}
