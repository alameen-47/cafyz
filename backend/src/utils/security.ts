import { z } from 'zod';

/** bcrypt DoS guard — reject oversized passwords before hashing/comparing. */
export const PASSWORD_MAX_LENGTH = 128;

export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`);

export const passwordLoginField = z
  .string()
  .min(1)
  .max(PASSWORD_MAX_LENGTH);

export const passwordChangeField = z
  .string()
  .min(1)
  .max(PASSWORD_MAX_LENGTH);

export function isPasswordTooLong(value: unknown): boolean {
  return typeof value === 'string' && value.length > PASSWORD_MAX_LENGTH;
}

/** Escape user input embedded in SQL LIKE patterns (% and _). */
export function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** HTML-escape for email templates and action pages (not SSTI — no template engine). */
export function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Run a regex against bounded input to reduce ReDoS risk from user-controlled strings.
 * Returns false when input exceeds maxLen without running the regex.
 */
export function safeRegexTest(re: RegExp, input: string, maxLen = 2000): boolean {
  if (input.length > maxLen) return false;
  return re.test(input);
}

/** Strip characters that could break out of mailto: or URL contexts in HTML emails. */
export function sanitizeEmailForHtmlAttr(email: string): string {
  return escHtml(email.replace(/[\s<>"']/g, ''));
}

/** Ensure object storage secrets never appear in API responses (Cloudinary/S3-style keys). */
const SECRET_KEY_PATTERN = /^(?:AWS_|S3_|CLOUDINARY_|RESEND_|BREVO_|TWILIO_|JWT_|2FACTOR|SMTP_)/i;

export function containsSecretKeyName(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export function redactSecretsFromObject<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (containsSecretKeyName(key)) {
      delete out[key];
    } else if (out[key] && typeof out[key] === 'object' && !Array.isArray(out[key])) {
      out[key] = redactSecretsFromObject(out[key] as Record<string, unknown>) as T[Extract<keyof T, string>];
    }
  }
  return out;
}
