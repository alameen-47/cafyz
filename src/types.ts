export type Screen =
  | 'login'
  | 'manager'
  | 'pos'
  | 'kds'
  | 'waiter'
  | 'menu'
  | 'inventory'
  | 'staff'
  | 'reports'
  | 'roles'
  | 'mobileOrders'
  | 'mobileTableDetail'
  | 'mobileAddItem'
  | 'license'
  | 'founder';

export type TableStatus = 'empty' | 'reserved' | 'occupied' | 'paying' | 'attention';
export type OrderStatus = 'Open' | 'Paid' | 'Voided' | 'New';
export type BadgeVariant = 'paid' | 'pending' | 'cancel' | 'new' | 'open';
