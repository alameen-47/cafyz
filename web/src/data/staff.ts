import type { Role } from '../context/AuthContext';

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  status: 'active' | 'break' | 'off';
  startTime: string;
  pin: string;
}

export const INITIAL_STAFF: StaffMember[] = [
  { id: '1', name: 'Mireille Vasseur', initials: 'MV', email: 'mireille@saint.paris', role: 'manager',  status: 'active', startTime: '17:30', pin: '1234' },
  { id: '2', name: 'Thomas Durand',    initials: 'TD', email: 'thomas@saint.paris',   role: 'cashier',  status: 'active', startTime: '18:00', pin: '5678' },
  { id: '3', name: 'Jules Renard',     initials: 'JR', email: 'jules@saint.paris',    role: 'waiter',   status: 'active', startTime: '18:00', pin: '9012' },
  { id: '4', name: 'Inès Moreau',      initials: 'IM', email: 'ines@saint.paris',     role: 'kitchen',  status: 'active', startTime: '16:00', pin: '3456' },
  { id: '5', name: 'Léo Fontaine',     initials: 'LF', email: 'leo@saint.paris',      role: 'waiter',   status: 'break',  startTime: '18:00', pin: '7890' },
  { id: '6', name: 'Amélie Blanc',     initials: 'AB', email: 'amelie@saint.paris',   role: 'waiter',   status: 'active', startTime: '19:00', pin: '2345' },
  { id: '7', name: 'Marc Lecomte',     initials: 'ML', email: 'marc@saint.paris',     role: 'kitchen',  status: 'active', startTime: '15:30', pin: '6789' },
  { id: '8', name: 'Sophie Girard',    initials: 'SG', email: 'sophie@saint.paris',   role: 'cashier',  status: 'off',    startTime: '—',     pin: '0123' },
];
