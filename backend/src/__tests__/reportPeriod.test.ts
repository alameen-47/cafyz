import { describe, it, expect } from 'vitest';
import { resolveRevenueWindow, weekBounds, monthBounds, periodLabel } from '../reportPeriod.js';

describe('reportPeriod', () => {
  it('day period uses single date', () => {
    const w = resolveRevenueWindow({ period: 'day', date: '2026-05-15' });
    expect(w).toEqual({ from: '2026-05-15', to: '2026-05-15', period: 'day' });
  });

  it('week period spans Mon–Sun', () => {
    const w = resolveRevenueWindow({ period: 'week', date: '2026-05-15' }); // Fri
    expect(w.from).toBe('2026-05-11');
    expect(w.to).toBe('2026-05-17');
    expect(w.period).toBe('week');
  });

  it('month period covers full calendar month', () => {
    const w = resolveRevenueWindow({ period: 'month', month: '2026-02' });
    expect(w).toEqual({ from: '2026-02-01', to: '2026-02-28', period: 'month' });
  });

  it('range period respects from/to', () => {
    const w = resolveRevenueWindow({ period: 'range', from: '2026-01-01', to: '2026-01-31' });
    expect(w).toEqual({ from: '2026-01-01', to: '2026-01-31', period: 'range' });
  });

  it('weekBounds matches resolveRevenueWindow', () => {
    expect(weekBounds('2026-05-15')).toEqual({ from: '2026-05-11', to: '2026-05-17' });
  });

  it('monthBounds matches resolveRevenueWindow', () => {
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('periodLabel formats month', () => {
    const label = periodLabel({ period: 'month', month: '2026-05' }, '2026-05-01', '2026-05-31');
    expect(label).toMatch(/May 2026/);
  });
});
