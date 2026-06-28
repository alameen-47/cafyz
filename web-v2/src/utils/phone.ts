/** E.164 phone helpers — keep in sync with backend/src/services/sms.ts */

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

/** Normalize user input or throw a friendly validation error. */
export function requireValidPhone(raw: string, label = 'Mobile number'): string {
  const norm = normalizePhone(raw);
  if (!norm || !isValidPhoneE164(norm)) {
    throw new Error(`${label} must be in international format (e.g. +971500000000).`);
  }
  return norm;
}

/** Optional phone — empty string returns undefined. */
export function optionalValidPhone(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return requireValidPhone(trimmed);
}
