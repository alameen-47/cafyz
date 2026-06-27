import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ENV_SNAPSHOT = { ...process.env };

describe('resolveResendFrom', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ENV_SNAPSHOT };
    process.env.APP_URL = 'https://cafyz.ametronyx.com';
    delete process.env.RESEND_SENDER_EMAIL;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ENV_SNAPSHOT };
  });

  it('maps Gmail override to verified app domain', async () => {
    process.env.RESEND_FROM = 'Cafyz <cafyzofficial@gmail.com>';
    const { resolveResendFrom } = await import('../services/email.js');
    expect(resolveResendFrom('"Cafyz System" <ametronyxx@gmail.com>')).toBe(
      '"Cafyz System" <noreply@cafyz.ametronyx.com>',
    );
  });

  it('uses RESEND_SENDER_EMAIL when set to a verified domain', async () => {
    process.env.RESEND_SENDER_EMAIL = 'noreply@cafyz.ametronyx.com';
    process.env.RESEND_FROM = 'Cafyz <noreply@cafyz.ametronyx.com>';
    const { resolveResendFrom } = await import('../services/email.js');
    expect(resolveResendFrom()).toBe('"Cafyz" <noreply@cafyz.ametronyx.com>');
  });

  it('smtpFrom uses verified sender when Resend is configured', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_SENDER_EMAIL = 'noreply@cafyz.ametronyx.com';
    process.env.SMTP_FROM = 'ametronyxx@gmail.com';
    const { smtpFrom } = await import('../services/email.js');
    expect(smtpFrom(false)).toBe('"Cafyz" <noreply@cafyz.ametronyx.com>');
    expect(smtpFrom(true)).toBe('"Cafyz System" <noreply@cafyz.ametronyx.com>');
  });

  it('founderFrom avoids Gmail when Resend is configured', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.RESEND_FROM = 'Cafyz <cafyzofficial@gmail.com>';
    const { founderFrom } = await import('../services/email.js');
    expect(founderFrom()).toBe('"Cafyz" <noreply@cafyz.ametronyx.com>');
  });
});
