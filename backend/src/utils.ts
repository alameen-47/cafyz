import { randomUUID } from 'crypto';
export const uid = () => randomUUID();

export function paginate(total: number, page: number, limit: number) {
  return { total, page, limit, pages: Math.ceil(total / limit) };
}
