import { Outlet, useLocation } from 'react-router-dom';
import { screenFromPath } from '../routes';
import { AppShell } from './AppShell';

export function ShellLayout() {
  const { pathname } = useLocation();
  const active = screenFromPath(pathname);

  return (
    <AppShell active={active}>
      <Outlet />
    </AppShell>
  );
}
