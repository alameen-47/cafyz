import type { Screen } from '@shared/types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

const CRUMBS: Partial<Record<Screen, [string, string]>> = {
  manager:   ['Operations', 'Overview'],
  inventory: ['Operations', 'Inventory'],
  staff:     ['Operations', 'Staff'],
  reports:   ['Operations', 'Reports'],
  roles:     ['Operations', 'Role Management'],
  pos:       ['Service', 'Point of Sale'],
  menu:      ['Service', 'Menu'],
  kds:       ['Kitchen', 'Expedite'],
  waiter:    ['Service', 'Floor Plan'],
};

const COVERS: Partial<Record<Screen, string>> = {
  pos: 'Dinner Service · Cover 84',
  menu: 'Dinner Service · Cover 84',
  kds: 'Line · 14 tickets',
  waiter: 'Dinner · Floor active',
};

export function AppShell({
  active,
  children,
}: {
  active: Screen;
  children: React.ReactNode;
}) {
  const crumb = CRUMBS[active] ?? ['Cafyz', 'Panel'];
  const cover = COVERS[active] ?? 'Service · Dinner';

  return (
    <div className="app-shell">
      <Sidebar active={active} />
      <div className="app-main">
        <TopBar crumb={crumb} cover={cover} />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
