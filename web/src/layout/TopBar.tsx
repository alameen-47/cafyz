import './TopBar.css';

interface TopBarProps {
  crumb: [string, string];
  clock?: string;
  cover?: string;
  right?: React.ReactNode;
}

export function TopBar({
  crumb,
  clock = '19:42',
  cover = 'Service · Dinner',
  right,
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-crumb">
        <span className="topbar-crumb-parent">{crumb[0]}</span>
        <span className="topbar-crumb-sep">›</span>
        <span className="topbar-crumb-current">{crumb[1]}</span>
      </div>
      <div className="topbar-pill">
        <span className="topbar-dot" />
        <span>{cover}</span>
        <span className="topbar-sep">·</span>
        <span className="mono">{clock}</span>
      </div>
      <div className="topbar-actions">
        {right}
        <button type="button" className="topbar-bell" aria-label="Notifications">
          🔔
          <span className="topbar-notif-dot" />
        </button>
      </div>
    </header>
  );
}
