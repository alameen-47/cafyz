/** Shared report period helpers (mirrors backend/src/reportPeriod.ts). */
export type ReportPeriod = 'day' | 'week' | 'month' | 'range';

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

export function periodLabel(
  period: ReportPeriod,
  from: string,
  to: string,
  month?: string,
): string {
  const fmt = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  if (period === 'day') return fmt(from);
  if (period === 'week') return `Week · ${fmt(from)} – ${fmt(to)}`;
  if (period === 'month') {
    const [y, m] = (month ?? from.slice(0, 7)).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  return `${fmt(from)} – ${fmt(to)}`;
}

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  day:   'Daily',
  week:  'Weekly',
  month: 'Monthly',
  range: 'Custom range',
};
