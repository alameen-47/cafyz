import { Outlet, useLocation } from 'react-router-dom';
import { screenFromPath } from '../routes';
import { AppShell } from './AppShell';

export function ShellLayout({ founderMode = false }: { founderMode?: boolean }) {
  const { pathname } = useLocation();
  const active = founderMode ? 'founder' : screenFromPath(pathname);

  return (
    <AppShell active={active}>
      <Outlet />
    </AppShell>
  );
}
