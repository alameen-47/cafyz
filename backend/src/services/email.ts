import nodemailer from 'nodemailer';

export const ADMIN_EMAIL =
  process.env.FOUNDER_NOTIFY_EMAIL
  ?? process.env.FOUNDER_EMAIL
  ?? 'ametronyxx@gmail.com';

export type EmailSendResult = { ok: true } | { ok: false; error: string };

export function isSmtpConfigured(): boolean {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  return Boolean(user && pass);
}

function smtpAuth() {
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? '').trim();
  if (!user || !pass) return null;
  return { user, pass };
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
    ...timeouts,
  });
}

/** Primary transporter — Gmail service mode works best from cloud hosts like Render. */
export function buildTransporter(): nodemailer.Transporter | null {
  const auth = smtpAuth();
  if (!auth) return null;
  const host = (process.env.SMTP_HOST ?? 'smtp.gmail.com').toLowerCase();
  if (host.includes('gmail')) {
    return transporterFromConfig({ service: 'gmail' });
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? ['1', 'true', 'yes'].includes(String(process.env.SMTP_SECURE).toLowerCase())
      : port === 465;
  return transporterFromConfig({ port, secure });
}

/** Fallback chain when primary SMTP config fails on cloud hosting. */
function buildFallbackTransporters(): nodemailer.Transporter[] {
  const auth = smtpAuth();
  if (!auth) return [];
  const host = (process.env.SMTP_HOST ?? 'smtp.gmail.com').toLowerCase();
  if (!host.includes('gmail')) return [];

  return [
    transporterFromConfig({ service: 'gmail' }),
    transporterFromConfig({ host: 'smtp.gmail.com', port: 465, secure: true }),
    transporterFromConfig({ host: 'smtp.gmail.com', port: 587, secure: false }),
  ].filter((t): t is nodemailer.Transporter => t !== null);
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

export async function sendMailReliable(
  mail: nodemailer.SendMailOptions,
  timeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS ?? 25000),
): Promise<EmailSendResult> {
  const candidates: nodemailer.Transporter[] = [];
  const primary = buildTransporter();
  if (primary) candidates.push(primary);
  for (const fb of buildFallbackTransporters()) {
    if (!candidates.includes(fb)) candidates.push(fb);
  }
  if (!candidates.length) {
    return { ok: false, error: 'SMTP not configured (SMTP_USER / SMTP_PASSWORD missing)' };
  }

  let lastError = 'unknown';
  for (const t of candidates) {
    try {
      await sendWithTransporter(t, mail, timeoutMs);
      return { ok: true };
    } catch (e) {
      lastError = (e as Error).message;
      // eslint-disable-next-line no-console
      console.error('[SMTP] send attempt failed:', lastError);
    }
  }
  return { ok: false, error: lastError };
}

export async function sendMailWithTimeout(
  transporter: nodemailer.Transporter,
  mail: nodemailer.SendMailOptions,
  timeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS ?? 25000),
): Promise<void> {
  await sendWithTransporter(transporter, mail, timeoutMs);
}

export async function sendMailBestEffort(
  transporter: nodemailer.Transporter,
  mail: nodemailer.SendMailOptions,
  logTag: string,
): Promise<void> {
  const r = await sendMailReliable(mail);
  if (!r.ok) {
    // eslint-disable-next-line no-console
    console.error(`[SMTP] ${logTag} failed:`, r.error);
  }
}
