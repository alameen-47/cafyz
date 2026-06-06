import './TopBar.css';

interface TopBarProps {
  crumb: [string, string];
  clock?: string;
  cover?: string;
  right?: React.ReactNode;
  onMenuClick?: () => void;
  menuOpen?: boolean;
  onSupportClick?: () => void;
  supportOpen?: boolean;
}

export function TopBar({
  crumb,
  clock = '19:42',
  cover = 'Service · Dinner',
  right,
  onMenuClick,
  menuOpen = false,
  onSupportClick,
  supportOpen = false,
}: TopBarProps) {
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
        <span className="mono">{clock}</span>
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
