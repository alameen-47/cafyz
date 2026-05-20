import type { Screen } from '@shared/types';

export const ROUTES: Record<Screen, string> = {
  login: '/login',
  manager: '/',
  pos: '/pos',
  kds: '/kds',
  waiter: '/tables',
  menu: '/menu',
  inventory: '/inventory',
  staff: '/staff',
  reports: '/reports',
  mobileOrders: '/mobile/orders',
  mobileTableDetail: '/mobile/table',
  mobileAddItem: '/mobile/add-item',
};

export function pathForScreen(screen: Screen): string {
  return ROUTES[screen];
}

export function screenFromPath(pathname: string): Screen {
  const entry = Object.entries(ROUTES).find(([, path]) => path === pathname);
  if (entry) return entry[0] as Screen;
  if (pathname.startsWith('/mobile/table')) return 'mobileTableDetail';
  return 'manager';
}

/** Screens that use the desktop sidebar shell */
export const DESKTOP_SHELL_SCREENS: Screen[] = [
  'manager',
  'pos',
  'kds',
  'waiter',
  'menu',
  'inventory',
  'staff',
  'reports',
];

export const MOBILE_SCREENS: Screen[] = [
  'mobileOrders',
  'mobileTableDetail',
  'mobileAddItem',
];
