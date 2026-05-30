/**
 * Send a test email using the configured provider (Resend when EMAIL_PROVIDER=resend).
 * Usage: npm run email:test
 */
import 'dotenv/config';
import { ADMIN_EMAIL, isResendConfigured, sendMailReliable } from '../src/services/email.js';

async function main() {
  const to = process.env.FOUNDER_EMAIL ?? ADMIN_EMAIL;
  if (!isResendConfigured()) {
    console.error('RESEND_API_KEY is missing in backend/.env');
    process.exit(1);
  }

  const r = await sendMailReliable({
    to,
    subject: `[Cafyz] Resend test — ${new Date().toISOString().slice(0, 19)}`,
    html: '<p><strong>Resend is working.</strong> Trial approval emails will use this channel.</p>',
  });

  console.log(JSON.stringify({ to, ...r }, null, 2));
  process.exit(r.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
