import { Router } from 'express';
import { z } from 'zod';
import nodemailer from 'nodemailer';

const router = Router();

const ADMIN_EMAIL = 'ametronyxx@gmail.com';

const InquirySchema = z.object({
  name:           z.string().min(1).max(120),
  restaurant_name: z.string().min(1).max(200),
  email:          z.string().email(),
  plan:           z.enum(['basic', 'pro', 'premium']),
  message:        z.string().max(1000).optional(),
});

const PLAN_LABELS: Record<string, string> = {
  basic:   'Basic — $49 / mo',
  pro:     'Pro — $99 / mo',
  premium: 'Premium — $199 / mo',
};

function buildTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth:   { user, pass },
  });
}

function adminHtml(name: string, restaurantName: string, email: string, plan: string, message?: string) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#07060F;font-family:Inter,Arial,sans-serif;color:#F5F5F0">
<div style="max-width:560px;margin:40px auto;border:0.5px solid rgba(139,92,246,0.3);border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#130F28 0%,#0E0B1C 100%);padding:32px">
    <div style="font-size:11px;color:#8B5CF6;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Cafyz · New Inquiry</div>
    <div style="font-family:Georgia,serif;font-size:28px;color:#F5F5F0;margin-bottom:4px">New Account Request</div>
    <div style="font-size:13px;color:#8A8A9A">A restaurant wants to join Cafyz</div>
  </div>
  <div style="padding:28px 32px;background:#0A0816">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px;width:40%">Contact Name</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#F5F5F0">${name}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px">Restaurant</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#F5F5F0">${restaurantName}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px">Email</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#8B5CF6"><a href="mailto:${email}" style="color:#8B5CF6;text-decoration:none">${email}</a></td></tr>
      <tr><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px">Plan Interest</td><td style="padding:10px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:14px;color:#F5F5F0"><span style="background:rgba(139,92,246,0.16);color:#8B5CF6;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600;text-transform:uppercase">${plan.toUpperCase()}</span>  ${PLAN_LABELS[plan]}</td></tr>
      ${message ? `<tr><td colspan="2" style="padding:16px 0 0"><div style="font-size:11px;color:#8A8A9A;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Message</div><div style="background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;padding:14px;font-size:14px;color:#B8B8C2;line-height:1.6">${message}</div></td></tr>` : ''}
    </table>
    <div style="margin-top:24px;padding:16px;background:rgba(139,92,246,0.08);border:0.5px solid rgba(139,92,246,0.25);border-radius:10px">
      <div style="font-size:11px;color:#8B5CF6;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px">Next Step</div>
      <div style="font-size:13px;color:#B8B8C2;line-height:1.6">Generate a <strong style="color:#F5F5F0">${plan.toUpperCase()}</strong> license key in the <a href="/founder" style="color:#8B5CF6;text-decoration:none">Founder Panel</a> and create their credentials. Reply to <a href="mailto:${email}" style="color:#8B5CF6">${email}</a> with access details.</div>
    </div>
  </div>
  <div style="padding:16px 32px;background:#07060F;text-align:center;font-size:11px;color:#5A5A6A">Cafyz Hospitality OS · Inquiry received ${new Date().toUTCString()}</div>
</div>
</body>
</html>`;
}

function autoReplyHtml(name: string, restaurantName: string, plan: string) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#07060F;font-family:Inter,Arial,sans-serif;color:#F5F5F0">
<div style="max-width:560px;margin:40px auto;border:0.5px solid rgba(139,92,246,0.3);border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#130F28 0%,#0E0B1C 100%);padding:40px 32px 32px">
    <div style="width:52px;height:52px;background:#8B5CF6;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:28px;color:#07060F;font-weight:700;margin-bottom:24px">C</div>
    <div style="font-size:11px;color:#8B5CF6;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">Cafyz Hospitality OS</div>
    <div style="font-family:Georgia,serif;font-size:32px;color:#F5F5F0;line-height:1.2;margin-bottom:12px">We received<br>your request, <em style="color:#8B5CF6">${name.split(' ')[0]}.</em></div>
    <div style="font-size:14px;color:#8A8A9A;line-height:1.6">Thank you for your interest in Cafyz — the hospitality operating system built for restaurants that run like clockwork.</div>
  </div>
  <div style="padding:32px;background:#0A0816">
    <div style="background:rgba(46,204,138,0.08);border:0.5px solid rgba(46,204,138,0.3);border-radius:12px;padding:20px;margin-bottom:28px;display:flex;align-items:flex-start;gap:14px">
      <div style="font-size:20px;margin-top:2px">✓</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#2ECC8A;margin-bottom:4px">Inquiry confirmed</div>
        <div style="font-size:13px;color:#B8B8C2;line-height:1.6">Your request for the <strong style="color:#F5F5F0">${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan</strong> for <strong style="color:#F5F5F0">${restaurantName}</strong> has been received. A Cafyz representative will be in touch within 24 hours.</div>
      </div>
    </div>
    <div style="font-size:13px;color:#8A8A9A;line-height:1.6;margin-bottom:24px">
      <strong style="color:#F5F5F0;display:block;margin-bottom:8px">What happens next?</strong>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:10px;align-items:flex-start"><div style="width:22px;height:22px;background:rgba(139,92,246,0.16);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#8B5CF6;font-weight:700;flex-shrink:0">1</div><span>Our founder reviews your request and prepares your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan configuration</span></div>
        <div style="display:flex;gap:10px;align-items:flex-start"><div style="width:22px;height:22px;background:rgba(139,92,246,0.16);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#8B5CF6;font-weight:700;flex-shrink:0">2</div><span>You receive your unique license key and login credentials via email</span></div>
        <div style="display:flex;gap:10px;align-items:flex-start"><div style="width:22px;height:22px;background:rgba(139,92,246,0.16);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#8B5CF6;font-weight:700;flex-shrink:0">3</div><span>Activate your account at cafyz.app/login and run your restaurant like a pro</span></div>
      </div>
    </div>
    <div style="border-top:0.5px solid rgba(255,255,255,0.06);padding-top:20px;font-size:13px;color:#8A8A9A">Questions? Reply directly to this email or reach us at <a href="mailto:${ADMIN_EMAIL}" style="color:#8B5CF6;text-decoration:none">${ADMIN_EMAIL}</a></div>
  </div>
  <div style="padding:16px 32px;background:#07060F;text-align:center;font-size:11px;color:#5A5A6A">© Cafyz Hospitality SAS · 2026 · All rights reserved</div>
</div>
</body>
</html>`;
}

// POST /api/inquiries
router.post('/', async (req, res, next) => {
  try {
    const body = InquirySchema.parse(req.body);
    const { name, restaurant_name, email, plan, message } = body;

    const transporter = buildTransporter();
    if (transporter) {
      await Promise.all([
        // Notification to admin
        transporter.sendMail({
          from: `"Cafyz System" <${process.env.SMTP_USER}>`,
          to:   ADMIN_EMAIL,
          subject: `[Cafyz] New ${plan.toUpperCase()} inquiry — ${restaurant_name}`,
          html: adminHtml(name, restaurant_name, email, plan, message),
        }),
        // Auto-reply to inquirer
        transporter.sendMail({
          from:    `"Cafyz" <${process.env.SMTP_USER}>`,
          to:      email,
          replyTo: ADMIN_EMAIL,
          subject: `We got your Cafyz request, ${name.split(' ')[0]} ✓`,
          html:    autoReplyHtml(name, restaurant_name, plan),
        }),
      ]);
    }

    res.status(201).json({
      ok:      true,
      message: 'Inquiry received. A representative will be in touch within 24 hours.',
    });
  } catch (e) {
    next(e);
  }
});

export default router;
