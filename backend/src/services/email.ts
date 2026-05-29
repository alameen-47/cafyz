import nodemailer from 'nodemailer';

export const ADMIN_EMAIL = process.env.FOUNDER_NOTIFY_EMAIL ?? 'ametronyxx@gmail.com';

export function buildTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user, pass },
    // Fail fast in production environments (Render) so HTTP requests don't hang.
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS ?? 8000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS ?? 8000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS ?? 12000),
  });
}

export function smtpFrom(system = false): string {
  const user = process.env.SMTP_USER ?? 'noreply@cafyz.io';
  return system ? `"Cafyz System" <${user}>` : `"Cafyz" <${user}>`;
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
