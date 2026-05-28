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
  });
}

export function smtpFrom(system = false): string {
  const user = process.env.SMTP_USER ?? 'noreply@cafyz.io';
  return system ? `"Cafyz System" <${user}>` : `"Cafyz" <${user}>`;
}
