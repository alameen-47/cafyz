import nodemailer from 'nodemailer';

export const ADMIN_EMAIL =
  process.env.FOUNDER_NOTIFY_EMAIL
  ?? process.env.FOUNDER_EMAIL
  ?? 'ametronyxx@gmail.com';

export function isSmtpConfigured(): boolean {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  return Boolean(user && pass);
}

export function buildTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? ['1', 'true', 'yes'].includes(String(process.env.SMTP_SECURE).toLowerCase())
      : port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
    // Fail fast in production environments (Render) so HTTP requests don't hang.
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 8000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 8000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 12000),
  });
}

export function smtpFrom(system = false): string {
  const addr = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@cafyz.io';
  const name = process.env.SMTP_FROM_NAME ?? 'Cafyz';
  return system ? `"${name} System" <${addr}>` : `"${name}" <${addr}>`;
}

export async function sendMailWithTimeout(
  transporter: nodemailer.Transporter,
  mail: nodemailer.SendMailOptions,
  timeoutMs = Number(process.env.SMTP_SEND_TIMEOUT_MS ?? 12000),
): Promise<void> {
  await Promise.race([
    transporter.sendMail(mail).then(() => {}),
    new Promise<void>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`SMTP send timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

export async function sendMailBestEffort(
  transporter: nodemailer.Transporter,
  mail: nodemailer.SendMailOptions,
  logTag: string,
): Promise<void> {
  try {
    await sendMailWithTimeout(transporter, mail);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`[SMTP] ${logTag} failed:`, (e as Error).message);
  }
}
