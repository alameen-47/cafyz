import { z } from 'zod';

export type ReportPeriod = 'day' | 'week' | 'month' | 'range';

export const RevenueQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'range']).default('range'),
  date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month:  z.string().regex(/^\d{4}-\d{2}$/).optional(),
  from:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type RevenueQuery = z.infer<typeof RevenueQuerySchema>;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return formatDateISO(new Date());
}

export function currentMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Monday–Sunday week containing `dateStr` (YYYY-MM-DD). */
export function weekBounds(dateStr: string): { from: string; to: string } {
  const d = new Date(`${dateStr}T12:00:00`);
  const diffToMon = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { from: formatDateISO(mon), to: formatDateISO(sun) };
}

export function monthBounds(monthStr: string): { from: string; to: string } {
  const [y, m] = monthStr.split('-').map(Number);
  const from = `${y}-${pad(m)}-01`;
  const last = new Date(y, m, 0);
  return { from, to: formatDateISO(last) };
}

export function resolveRevenueWindow(q: RevenueQuery): { from: string; to: string; period: ReportPeriod } {
  const period = q.period ?? 'range';
  if (period === 'day') {
    const day = q.date ?? todayISO();
    return { from: day, to: day, period };
  }
  if (period === 'week') {
    const b = weekBounds(q.date ?? todayISO());
    return { ...b, period };
  }
  if (period === 'month') {
    const b = monthBounds(q.month ?? currentMonthISO());
    return { ...b, period };
  }
  const to = q.to ?? todayISO();
  const fromDefault = new Date(`${to}T12:00:00`);
  fromDefault.setDate(fromDefault.getDate() - 29);
  const from = q.from ?? formatDateISO(fromDefault);
  return { from, to, period };
}

export function periodLabel(q: RevenueQuery, from: string, to: string): string {
  const fmt = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  if (q.period === 'day') return fmt(from);
  if (q.period === 'week') return `Week · ${fmt(from)} – ${fmt(to)}`;
  if (q.period === 'month') {
    const [y, m] = (q.month ?? from.slice(0, 7)).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  return `${fmt(from)} – ${fmt(to)}`;
}
