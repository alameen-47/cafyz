import { describe, it, expect } from 'vitest';
import {
  calendarDaysUntilExpiry,
  pickReminderSlot,
  shouldSendReminder,
  localParts,
} from '../services/trialReminderScheduler.js';

describe('trial reminder scheduler', () => {
  it('pickReminderSlot returns 10:00 and 18:00 windows', () => {
    expect(pickReminderSlot(10, 0)).toBe('10:00');
    expect(pickReminderSlot(10, 30)).toBe('10:00');
    expect(pickReminderSlot(18, 5)).toBe('18:00');
    expect(pickReminderSlot(9, 59)).toBeNull();
    expect(pickReminderSlot(11, 0)).toBeNull();
    expect(pickReminderSlot(19, 0)).toBeNull();
  });

  it('shouldSendReminder covers 0–3 days inclusive', () => {
    expect(shouldSendReminder(3)).toBe(true);
    expect(shouldSendReminder(2)).toBe(true);
    expect(shouldSendReminder(1)).toBe(true);
    expect(shouldSendReminder(0)).toBe(true);
    expect(shouldSendReminder(4)).toBe(false);
    expect(shouldSendReminder(-1)).toBe(false);
  });

  it('calendarDaysUntilExpiry uses restaurant timezone', () => {
    const tz = 'Asia/Kolkata';
    const now = new Date('2026-06-21T06:00:00Z'); // morning IST Jun 21
    const expires = '2026-06-24T18:30:00Z';
    const days = calendarDaysUntilExpiry(expires, tz, now);
    expect(days).toBeGreaterThanOrEqual(2);
    expect(days).toBeLessThanOrEqual(4);
  });

  it('localParts returns date and hour', () => {
    const p = localParts('UTC', new Date('2026-06-21T10:05:00Z'));
    expect(p.date).toBe('2026-06-21');
    expect(p.hour).toBe(10);
    expect(p.minute).toBe(5);
  });
});
