import type { ApiMenuCategory, ApiMenuItem } from '../services/api';

export function slugifyCategoryLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'category';
}

export function categoryLabelMap(categories: ApiMenuCategory[]): Record<string, string> {
  return Object.fromEntries(categories.map(c => [c.slug, c.label]));
}

export function buildMenuCategoryTabs(categories: ApiMenuCategory[], items: ApiMenuItem[]) {
  const tabs = [
    { id: 'all', label: 'All' },
    ...categories.map(c => ({ id: c.slug, label: c.label })),
  ];
  return tabs.map(c => ({
    ...c,
    count: c.id === 'all' ? items.length : items.filter(i => i.category === c.id).length,
  }));
}

export function defaultCategorySlug(categories: ApiMenuCategory[]): string {
  return categories.find(c => c.slug === 'mains')?.slug ?? categories[0]?.slug ?? 'mains';
}
