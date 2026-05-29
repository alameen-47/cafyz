import nodemailer from 'nodemailer';

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

function parseFromHeader(from: string): { email: string; name?: string } {
  const m = from.match(/^"([^"]*)"\s*<([^>]+)>$/);
  if (m) return { name: m[1] || undefined, email: m[2] };
  const m2 = from.match(/^([^<]+)<([^>]+)>$/);
  if (m2) return { name: m2[1].trim() || undefined, email: m2[2].trim() };
  return { email: from.replace(/^<|>$/g, '').trim() };
}

function httpFromAddress(system: boolean): string {
  const custom = process.env.RESEND_FROM ?? process.env.BREVO_FROM;
  if (custom) return custom;
  return smtpFrom(system);
}

async function sendViaResend(mail: nodemailer.SendMailOptions): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not set' };

  const to = normalizeRecipients(mail.to);
  if (!to.length) return { ok: false, error: 'Missing recipient' };

  // RESEND_FROM (a verified-domain sender) must win over any per-call from,
  // otherwise Resend rejects sends whose sender domain isn't verified.
  const from = String(process.env.RESEND_FROM?.trim() || mail.from || httpFromAddress(false));
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

  // BREVO_FROM (a verified sender) must win over any per-call from, otherwise
  // Brevo rejects the send with "sender not valid".
  const fromHeader = String(process.env.BREVO_FROM?.trim() || mail.from || httpFromAddress(false));
  const { email, name } = parseFromHeader(fromHeader);

  const payload: Record<string, unknown> = {
    sender: { email, name: name ?? process.env.SMTP_FROM_NAME ?? 'Cafyz' },
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
  if (isResendConfigured()) {
    const r = await sendViaResend(mail);
    if (r.ok) return r;
    // eslint-disable-next-line no-console
    console.error('[Resend] send failed:', r.error);
  }

  if (isBrevoConfigured()) {
    const r = await sendViaBrevo(mail);
    if (r.ok) return r;
    // eslint-disable-next-line no-console
    console.error('[Brevo] send failed:', r.error);
  }

  if (isRenderSmtpBlocked() && !isSmtpConfigured()) {
    return { ok: false, error: RENDER_SMTP_BLOCKED_MSG };
  }

  if (isRenderSmtpBlocked() && (isResendConfigured() || isBrevoConfigured())) {
    return { ok: false, error: `HTTP email failed; ${RENDER_SMTP_BLOCKED_MSG}` };
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
