import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type SmsSendResult =
  | { ok: true; provider: string; details?: string }
  | { ok: false; error: string; details?: string };

const E164_RE = /^\+[1-9]\d{7,14}$/;

export function normalizePhone(input: string): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith('+')) return cleaned;
  return `+${cleaned}`;
}

export function isValidPhoneE164(phone: string): boolean {
  return E164_RE.test(phone);
}

function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
    process.env.TWILIO_AUTH_TOKEN?.trim() &&
    process.env.TWILIO_FROM_PHONE?.trim(),
  );
}

let cachedTwoFactorSecret: string | null = null;

function readTwoFactorSecretFromDotEnv(): string {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'backend/.env'),
  ];
  for (const envPath of candidates) {
    try {
      const content = readFileSync(envPath, 'utf8');
      const line = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l.startsWith('2FACTOR_SECRET='));
      if (!line) continue;
      const raw = line.slice('2FACTOR_SECRET='.length).trim();
      if (!raw) continue;
      if (
        (raw.startsWith('"') && raw.endsWith('"'))
        || (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        return raw.slice(1, -1).trim();
      }
      return raw;
    } catch {
      // continue to next candidate
    }
  }
  return '';
}

function twoFactorSecret(): string {
  if (cachedTwoFactorSecret !== null) return cachedTwoFactorSecret;
  const envValue = (process.env['2FACTOR_SECRET'] ?? process.env.TWOFACTOR_SECRET ?? '').trim();
  const resolved = envValue || readTwoFactorSecretFromDotEnv();
  cachedTwoFactorSecret = resolved;
  return resolved;
}

function twoFactorConfigured(): boolean {
  return Boolean(twoFactorSecret());
}

function twoFactorTemplateName(): string {
  return (
    process.env.TWOFACTOR_TEMPLATE_NAME
    ?? process.env['2FACTOR_TEMPLATE_NAME']
    ?? ''
  ).trim();
}

function toProviderPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function isTwoFactorSuccess(payload: unknown): boolean {
  const status = String((payload as { Status?: unknown })?.Status ?? '').toLowerCase();
  return status === 'success';
}

function isTwoFactorV4Success(payload: unknown): boolean {
  const status = String((payload as { status?: unknown; Status?: unknown })?.status ?? (payload as { Status?: unknown })?.Status ?? '').toLowerCase();
  return status === 'sent' || status === 'success' || status === 'ok';
}

async function sendVia2FactorOtpV4(to: string): Promise<SmsSendResult> {
  const secret = twoFactorSecret();
  if (!secret) return { ok: false, error: '2Factor is not configured' };
  const template = twoFactorTemplateName() || 'OTP';
  try {
    const res = await fetch('https://2factor.in/API/V1/OTP/SEND', {
      method: 'POST',
      headers: {
        'X-API-Key': secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to,
        channel: 'SMS',
        template,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !isTwoFactorV4Success(data)) {
      const details = String(
        (data as { details?: unknown; Details?: unknown; message?: unknown; error?: unknown })?.details
          ?? (data as { Details?: unknown })?.Details
          ?? (data as { message?: unknown })?.message
          ?? (data as { error?: unknown })?.error
          ?? res.statusText,
      );
      return { ok: false, error: `2Factor v4 ${res.status}: ${details}`, details };
    }
    const details = String(
      (data as { session_id?: unknown; request_id?: unknown; Details?: unknown; details?: unknown })?.session_id
        ?? (data as { request_id?: unknown })?.request_id
        ?? (data as { Details?: unknown })?.Details
        ?? (data as { details?: unknown })?.details
        ?? '',
    );
    return { ok: true, provider: '2factor-v4', details };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function sendVia2FactorOtp(to: string, otpCode: string): Promise<SmsSendResult> {
  const secret = twoFactorSecret();
  if (!secret) return { ok: false, error: '2Factor is not configured' };
  const recipient = toProviderPhone(to);
  if (recipient.length < 8 || recipient.length > 16) {
    return { ok: false, error: '2Factor recipient format is invalid' };
  }

  const template = twoFactorTemplateName();
  const url = template
    ? `https://2factor.in/API/V1/${encodeURIComponent(secret)}/SMS/${encodeURIComponent(recipient)}/${encodeURIComponent(otpCode)}/${encodeURIComponent(template)}`
    : `https://2factor.in/API/V1/${encodeURIComponent(secret)}/SMS/${encodeURIComponent(recipient)}/${encodeURIComponent(otpCode)}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !isTwoFactorSuccess(data)) {
      const details = String((data as { Details?: unknown })?.Details ?? res.statusText);
      return { ok: false, error: `2Factor ${res.status}: ${details}`, details };
    }
    const details = String((data as { Details?: unknown })?.Details ?? '');
    return { ok: true, provider: '2factor', details };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function sendViaTwilio(to: string, body: string): Promise<SmsSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN?.trim() ?? '';
  const from = process.env.TWILIO_FROM_PHONE?.trim() ?? '';
  if (!sid || !token || !from) return { ok: false, error: 'Twilio is not configured' };

  try {
    const form = new URLSearchParams({ To: to, From: from, Body: body });
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `Twilio ${res.status}: ${txt.slice(0, 240)}` };
    }
    return { ok: true, provider: 'twilio' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function sendOtpSms(
  to: string,
  otpCode: string,
  options?: { context?: 'login' | 'staff_pin'; ttlMinutes?: number },
): Promise<SmsSendResult> {
  if (process.env.NODE_ENV === 'test') {
    console.log(`[OTP-DEV] ${to} => ${otpCode}`);
    return { ok: true, provider: 'dev-log' };
  }

  let twoFactorFailure: SmsSendResult | null = null;
  if (twoFactorConfigured()) {
    const via2FactorV4 = await sendVia2FactorOtpV4(to);
    if (via2FactorV4.ok) return via2FactorV4;

    const via2Factor = await sendVia2FactorOtp(to, otpCode);
    if (via2Factor.ok) return via2Factor;
    twoFactorFailure = !via2FactorV4.ok
      ? { ok: false, error: `${via2FactorV4.error} | ${via2Factor.error}` }
      : via2Factor;
  }

  const ttl = options?.ttlMinutes ?? 10;
  const label = options?.context === 'staff_pin' ? 'staff login PIN' : 'login code';
  const body = `Your Cafyz ${label} is ${otpCode}. It expires in ${ttl} minutes.`;
  if (twilioConfigured()) return sendViaTwilio(to, body);
  if (twoFactorFailure && !twoFactorFailure.ok) return twoFactorFailure;

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[OTP-DEV] ${to} => ${otpCode}`);
    return { ok: true, provider: 'dev-log' };
  }
  return { ok: false, error: 'SMS provider not configured (set 2FACTOR_SECRET or Twilio env vars)' };
}
