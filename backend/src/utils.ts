import { randomUUID } from 'crypto';
export const uid = () => randomUUID();

export function slugifyCategory(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'category';
}

export function paginate(total: number, page: number, limit: number) {
  return { total, page, limit, pages: Math.ceil(total / limit) };
}
