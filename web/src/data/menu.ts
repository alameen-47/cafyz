export const DISHES = [
  { id: 1, cat: 'starters', name: 'Burrata di Andria', price: 18, sub: 'Heirloom tomato · basil oil', sym: '◯' },
  { id: 2, cat: 'starters', name: 'Tuna Crudo', price: 24, sub: 'Citrus · radish · togarashi', sym: '~' },
  { id: 3, cat: 'starters', name: 'Beef Tartare', price: 22, sub: 'Cured yolk · cornichon', sym: '◐' },
  { id: 4, cat: 'mains', name: 'Côte de Bœuf', price: 64, sub: '500g · bone marrow butter', sym: '◐' },
  { id: 5, cat: 'mains', name: 'Black Cod Miso', price: 42, sub: 'Saikyo · pickled ginger', sym: '~', popular: true },
  { id: 6, cat: 'mains', name: 'Risotto Milanese', price: 32, sub: 'Saffron · 24-month parmigiano', sym: '✦' },
  { id: 7, cat: 'mains', name: "Duck à l'Orange", price: 46, sub: 'Confit leg · gastrique', sym: '◐' },
  { id: 8, cat: 'mains', name: 'Lobster Linguine', price: 58, sub: 'Maine · bisque · tarragon', sym: '✦', popular: true },
  { id: 9, cat: 'mains', name: 'Wagyu A5 Sando', price: 78, sub: 'Milk bread · katsu', sym: '◐' },
  { id: 10, cat: 'desserts', name: 'Soufflé Grand Marnier', price: 16, sub: 'Crème anglaise', sym: '◇' },
  { id: 11, cat: 'desserts', name: 'Île Flottante', price: 14, sub: 'Almond praline', sym: '◇' },
  { id: 12, cat: 'desserts', name: 'Tarte Tatin', price: 15, sub: 'Crème fraîche', sym: '◇' },
] as const;

export const CATEGORIES = [
  { id: 'all', label: 'All', count: 12 },
  { id: 'starters', label: 'Starters', count: 3 },
  { id: 'mains', label: 'Mains', count: 6 },
  { id: 'desserts', label: 'Desserts', count: 3 },
  { id: 'wine', label: 'Wine', count: 14 },
  { id: 'drinks', label: 'Drinks', count: 8 },
];

export type OrderItem = { id: number; qty: number; mods: string[] };

export const INITIAL_ORDER: OrderItem[] = [
  { id: 5, qty: 2, mods: ['No ginger', 'Extra miso'] },
  { id: 8, qty: 1, mods: ['Spice ×2'] },
  { id: 10, qty: 2, mods: [] },
  { id: 1, qty: 1, mods: [] },
];
