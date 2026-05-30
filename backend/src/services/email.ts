import nodemailer from 'nodemailer';
import { APP_URL } from '../config/site.js';

/** Prefer IPv4 for SMTP — avoids ENETUNREACH to Gmail over IPv6 on cloud hosts. */
const SMTP_FAMILY = 4 as const;

const RENDER_SMTP_BLOCKED_MSG =
  'Render free tier blocks outbound SMTP (ports 465/587). Set RESEND_API_KEY or BREVO_API_KEY on Render, or upgrade to a paid Render instance.';

export const ADMIN_EMAIL =
  process.env.FOUNDER_NOTIFY_EMAIL
  ?? process.env.FOUNDER_EMAIL
  ?? 'ametronyxx@gmail.com';

export type EmailSendResult = { ok: true; provider?: string } | { ok: false; error: string };

export function isSmtpConfigured(): boolean {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  return Boolean(user && pass);
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

/** True when any outbound email path is configured (HTTP API or SMTP). */
export function isEmailConfigured(): boolean {
  return isResendConfigured() || isBrevoConfigured() || isSmtpConfigured();
}

function isRenderSmtpBlocked(): boolean {
  return process.env.RENDER === 'true' && process.env.RENDER_ALLOW_SMTP !== 'true';
}

function smtpAuth() {
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? '').trim();
  if (!user || !pass) return null;
  return { user, pass };
}

function normalizeRecipients(to: nodemailer.SendMailOptions['to']): string[] {
  if (!to) return [];
  const list = Array.isArray(to) ? to : [to];
  return list.map((entry) => {
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object' && entry && 'address' in entry) return String(entry.address);
    return String(entry);
  });
}

function stripEnvQuotes(value: string): string {
  const t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"'))
    || (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function parseFromHeader(from: string): { email: string; name?: string } {
  const raw = stripEnvQuotes(from);
  const m = raw.match(/^"([^"]*)"\s*<([^>]+)>$/);
  if (m) return { name: m[1] || undefined, email: m[2].trim() };
  const m2 = raw.match(/^([^<]+)<([^>]+)>$/);
  if (m2) return { name: m2[1].trim() || undefined, email: m2[2].trim() };
  return { email: raw.replace(/^<|>$/g, '').trim() };
}

function resolveBrevoSender(): { email: string; name: string } {
  const email = (
    process.env.BREVO_SENDER_EMAIL
    ?? process.env.SMTP_FROM
    ?? process.env.SMTP_USER
    ?? ''
  ).trim();
  const name = (process.env.BREVO_SENDER_NAME ?? process.env.SMTP_FROM_NAME ?? 'Cafyz').trim();
  if (email) return { email, name };

  const fromHeader = stripEnvQuotes(process.env.BREVO_FROM?.trim() ?? smtpFrom(false));
  const parsed = parseFromHeader(fromHeader);
  return { email: parsed.email, name: parsed.name ?? name };
}

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
]);

function appMailDomain(): string | null {
  try {
    const host = new URL(APP_URL).hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.onrender.com') || host.endsWith('.vercel.app')) {
      return null;
    }
    // Use full app hostname — Resend often verifies the subdomain (e.g. cafyz.ametronyx.com).
    if (host.split('.').length >= 2) return host;
    return null;
  } catch {
    return null;
  }
}

/** Resend `from` — use verified domain (e.g. noreply@ametronyx.com), not onboarding@resend.dev in production. */
export function resolveResendFrom(): string {
  const name = process.env.SMTP_FROM_NAME ?? 'Cafyz';
  const testFallback = `"${name}" <onboarding@resend.dev>`;

  const senderEmail = (
    process.env.RESEND_SENDER_EMAIL?.trim()
    ?? (process.env.RESEND_FROM?.trim() ? parseFromHeader(stripEnvQuotes(process.env.RESEND_FROM)).email : null)
  )?.toLowerCase();

  if (senderEmail && senderEmail !== 'onboarding@resend.dev') {
    const domain = senderEmail.split('@')[1] ?? '';
    if (!FREE_MAIL_DOMAINS.has(domain)) {
      const displayName = process.env.RESEND_FROM?.trim()
        ? (parseFromHeader(stripEnvQuotes(process.env.RESEND_FROM)).name ?? name)
        : name;
      return `"${displayName}" <${senderEmail}>`;
    }
    // eslint-disable-next-line no-console
    console.warn(`[Resend] Cannot send from @${domain}. Using verified app domain instead.`);
  }

  const mailDomain = appMailDomain();
  if (mailDomain) {
    const local = process.env.RESEND_SENDER_LOCAL ?? 'noreply';
    return `"${name}" <${local}@${mailDomain}>`;
  }

  return testFallback;
}

export function isResendTestSender(): boolean {
  return resolveResendFrom().includes('onboarding@resend.dev');
}

function httpFromAddress(system: boolean): string {
  if (isResendConfigured()) return resolveResendFrom();
  const custom = process.env.BREVO_FROM;
  if (custom) return stripEnvQuotes(custom);
  return smtpFrom(system);
}

async function sendViaResend(mail: nodemailer.SendMailOptions): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not set' };

  const to = normalizeRecipients(mail.to);
  if (!to.length) return { ok: false, error: 'Missing recipient' };

  const from = resolveResendFrom();
  const body: Record<string, unknown> = {
    from,
    to,
    subject: String(mail.subject ?? '(no subject)'),
    html: String(mail.html ?? mail.text ?? ''),
  };
  if (mail.replyTo) body.reply_to = mail.replyTo;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.EMAIL_HTTP_TIMEOUT_MS ?? 15000)),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${errText.slice(0, 300)}` };
    }
    return { ok: true, provider: 'resend' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function sendViaBrevo(mail: nodemailer.SendMailOptions): Promise<EmailSendResult> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: 'BREVO_API_KEY not set' };

  const to = normalizeRecipients(mail.to);
  if (!to.length) return { ok: false, error: 'Missing recipient' };

  const { email, name } = resolveBrevoSender();
  if (!email) {
    return { ok: false, error: 'Brevo sender missing — set BREVO_SENDER_EMAIL (must be verified in Brevo)' };
  }

  const payload: Record<string, unknown> = {
    sender: { email, name },
    to: to.map((address) => ({ email: address })),
    subject: String(mail.subject ?? '(no subject)'),
    htmlContent: String(mail.html ?? mail.text ?? ''),
  };
  if (mail.replyTo) {
    const reply = typeof mail.replyTo === 'string' ? mail.replyTo : String(mail.replyTo);
    payload.replyTo = { email: reply.replace(/^.*<([^>]+)>.*$/, '$1').trim() || reply };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Number(process.env.EMAIL_HTTP_TIMEOUT_MS ?? 15000)),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `Brevo ${res.status}: ${errText.slice(0, 300)}` };
    }
    return { ok: true, provider: 'brevo' };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function transporterFromConfig(cfg: {
  host?: string;
  port?: number;
  secure?: boolean;
  service?: string;
}): nodemailer.Transporter | null {
  const auth = smtpAuth();
  if (!auth) return null;
  const timeouts = {
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 20000),
  };
  if (cfg.service) {
    return nodemailer.createTransport({ service: cfg.service, auth, ...timeouts });
  }
  const port = cfg.port ?? 587;
  const secure = cfg.secure ?? port === 465;
  return nodemailer.createTransport({
    host: cfg.host ?? process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port,
    secure,
    requireTLS: !secure,
    auth,
    family: SMTP_FAMILY,
    ...timeouts,
  } as nodemailer.TransportOptions);
}

/** Primary transporter — Gmail over IPv4:465 first. */
export function buildTransporter(): nodemailer.Transporter | null {
  const auth = smtpAuth();
  if (!auth) return null;
  const host = (process.env.SMTP_HOST ?? 'smtp.gmail.com').toLowerCase();
  if (host.includes('gmail')) {
    return transporterFromConfig({ host: 'smtp.gmail.com', port: 465, secure: true });
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? ['1', 'true', 'yes'].includes(String(process.env.SMTP_SECURE).toLowerCase())
      : port === 465;
  return transporterFromConfig({ host, port, secure });
}

function buildAllTransporters(): nodemailer.Transporter[] {
  if (!smtpAuth()) return [];
  const host = (process.env.SMTP_HOST ?? 'smtp.gmail.com').toLowerCase();
  if (host.includes('gmail')) {
    return [
      transporterFromConfig({ host: 'smtp.gmail.com', port: 465, secure: true }),
      transporterFromConfig({ service: 'gmail' }),
      transporterFromConfig({ host: 'smtp.gmail.com', port: 587, secure: false }),
    ].filter((t): t is nodemailer.Transporter => t !== null);
  }
  const primary = buildTransporter();
  return primary ? [primary] : [];
}

export function smtpFrom(system = false): string {
  const addr = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@cafyz.io';
  const name = process.env.SMTP_FROM_NAME ?? 'Cafyz';
  return system ? `"${name} System" <${addr}>` : `"${name}" <${addr}>`;
}

async function sendWithTransporter(
  transporter: nodemailer.Transporter,
  mail: nodemailer.SendMailOptions,
  timeoutMs: number,
): Promise<void> {
  await Promise.race([
    transporter.sendMail(mail).then(() => {}),
    new Promise<void>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`SMTP send timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

async function sendViaSmtp(
  mail: nodemailer.SendMailOptions,
  timeoutMs: number,
): Promise<EmailSendResult> {
  if (isRenderSmtpBlocked()) {
    return { ok: false, error: RENDER_SMTP_BLOCKED_MSG };
  }

  const candidates = buildAllTransporters();
  if (!candidates.length) {
    return { ok: false, error: 'SMTP not configured (SMTP_USER / SMTP_PASSWORD missing)' };
  }

  let lastError = 'unknown';
  for (const t of candidates) {
    try {
      await sendWithTransporter(t, mail, timeoutMs);
      return { ok: true, provider: 'smtp' };
    } catch (e) {
      lastError = (e as Error).message;
      // eslint-disable-next-line no-console
      console.error('[SMTP] send attempt failed:', lastError);
    }
  }
  return { ok: false, error: lastError };
}

/** Send email via HTTPS API (Render-safe) or SMTP fallback. */
export async function sendMailReliable(
  mail: nodemailer.SendMailOptions,
  timeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS ?? 12000),
): Promise<EmailSendResult> {
  const httpErrors: string[] = [];
  const prefer = (process.env.EMAIL_PROVIDER ?? '').toLowerCase();

  const tryResend = async () => {
    if (!isResendConfigured()) return null;
    const r = await sendViaResend(mail);
    if (r.ok) return r;
    // eslint-disable-next-line no-console
    console.error('[Resend] send failed:', r.error);
    httpErrors.push(r.error);
    return null;
  };

  const tryBrevo = async () => {
    if (!isBrevoConfigured()) return null;
    const r = await sendViaBrevo(mail);
    if (r.ok) return r;
    // eslint-disable-next-line no-console
    console.error('[Brevo] send failed:', r.error);
    httpErrors.push(r.error);
    return null;
  };

  let result: EmailSendResult | null = null;
  if (prefer === 'brevo') {
    result = await tryBrevo() ?? await tryResend();
  } else if (prefer === 'resend') {
    result = await tryResend();
  } else {
    result = await tryResend() ?? await tryBrevo();
  }
  if (result) return result;

  if (httpErrors.length) {
    return { ok: false, error: httpErrors.join(' | ') };
  }

  if (isRenderSmtpBlocked()) {
    if (!isSmtpConfigured()) return { ok: false, error: RENDER_SMTP_BLOCKED_MSG };
  }

  if (prefer === 'resend' || prefer === 'brevo') {
    return { ok: false, error: `${prefer} not configured or send failed` };
  }

  return sendViaSmtp(mail, timeoutMs);
}

export async function sendMailWithTimeout(
  transporter: nodemailer.Transporter,
  mail: nodemailer.SendMailOptions,
  timeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS ?? 25000),
): Promise<void> {
  await sendWithTransporter(transporter, mail, timeoutMs);
}

export async function sendMailBestEffort(
  _transporter: nodemailer.Transporter | null,
  mail: nodemailer.SendMailOptions,
  logTag: string,
): Promise<void> {
  const r = await sendMailReliable(mail);
  if (!r.ok) {
    // eslint-disable-next-line no-console
    console.error(`[Email] ${logTag} failed:`, r.error);
  }
}
