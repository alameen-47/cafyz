import type { RevenueQueryParams } from './api';

export const ANALYTICS_PRESETS = ['Today', '7 Days', '30 Days', '3 Months', 'Custom'] as const;
export type AnalyticsPreset = typeof ANALYTICS_PRESETS[number];

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function currentMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function defaultCustomFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return isoDate(d);
}

/** Maps UI period controls → API query (same filter for charts and reports). */
export function buildAnalyticsQuery(opts: {
  preset: AnalyticsPreset;
  anchorDate: string;
  month: string;
  customFrom: string;
  customTo: string;
}): RevenueQueryParams {
  const { preset, anchorDate, month, customFrom, customTo } = opts;
  if (preset === 'Custom') {
    const from = customFrom <= customTo ? customFrom : customTo;
    const to = customFrom <= customTo ? customTo : customFrom;
    return { period: 'range', from, to };
  }
  if (preset === 'Today') return { period: 'day', date: anchorDate };
  if (preset === '7 Days') return { period: 'week', date: anchorDate };
  if (preset === '30 Days') return { period: 'month', month };
  const to = anchorDate;
  const fromD = new Date(`${to}T12:00:00`);
  fromD.setDate(fromD.getDate() - 89);
  return { period: 'range', from: isoDate(fromD), to };
}

export function formatFilterRange(from: string, to: string): string {
  const fmt = (s: string) => {
    const d = new Date(`${s}T12:00:00`);
    return isNaN(d.getTime())
      ? s
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  if (from === to) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

export function reportPeriodCaption(periodLabel: string, from: string, to: string): string {
  const range = formatFilterRange(from, to);
  if (periodLabel.includes(range) || periodLabel === range) return periodLabel;
  return `${periodLabel} · ${range}`;
}
