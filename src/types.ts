export type Screen =
  | 'login'
  | 'manager'
  | 'pos'
  | 'kds'
  | 'waiter'
  | 'tableSetup'
  | 'menu'
  | 'inventory'
  | 'staff'
  | 'reports'
  | 'roles'
  | 'license'
  | 'founder'
  | 'mobileOrders'
  | 'mobileTableDetail'
  | 'mobileAddItem';

export type TableStatus = 'empty' | 'reserved' | 'occupied' | 'paying' | 'attention';
export type OrderStatus = 'Open' | 'Paid' | 'Voided' | 'New';
export type BadgeVariant = 'paid' | 'pending' | 'cancel' | 'new' | 'open';
