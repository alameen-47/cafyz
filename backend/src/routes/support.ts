import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const AskSupportSchema = z.object({
  message: z.string().min(2).max(1200),
  screen: z.string().max(80).optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string().max(1200),
  })).max(20).optional(),
});

type SupportCategory =
  | 'printer'
  | 'billing'
  | 'login'
  | 'permissions'
  | 'orders'
  | 'menu'
  | 'reports'
  | 'general';

function detectCategory(message: string): SupportCategory {
  const text = message.toLowerCase();
  if (/(print|printer|bluetooth|usb|receipt|thermal|kitchen)/.test(text)) return 'printer';
  if (/(trial|license|plan|billing|subscription|payment)/.test(text)) return 'billing';
  if (/(login|otp|pin|password|auth|signin|sign in)/.test(text)) return 'login';
  if (/(role|permission|access|manager|cashier|waiter|kitchen panel)/.test(text)) return 'permissions';
  if (/(order|pos|checkout|table|send to kitchen)/.test(text)) return 'orders';
  if (/(menu|category|item|price)/.test(text)) return 'menu';
  if (/(report|sales|dashboard|analytics)/.test(text)) return 'reports';
  return 'general';
}

function buildResponse(args: {
  category: SupportCategory;
  message: string;
  role: string;
  screen?: string;
  name?: string;
}) {
  const rolePrefix = args.role === 'founder'
    ? 'Founder support mode is active.'
    : `Role detected: ${args.role}.`;
  const screenHint = args.screen ? `Current screen: ${args.screen}.` : '';
  const greet = args.name ? `Hi ${args.name.split(' ')[0]},` : 'Hi,';

  switch (args.category) {
    case 'printer':
      return {
        reply: `${greet} I can help with printer setup. ${rolePrefix} ${screenHint} First connect Bluetooth or USB from the panel printer controls, run Kitchen/Cashier test checks, then confirm toast shows "sent". If it fails, disconnect and reconnect printer, keep only one browser tab open, and retry the One Click Both test.`,
        suggestions: [
          'Run Kitchen Printer Check',
          'Run Cashier Printer Check',
          'Try One Click Check Both',
          'Disconnect and reconnect printer',
        ],
        quick_actions: [
          { label: 'Open POS', path: '/pos' },
          { label: 'Open Kitchen', path: '/kds' },
        ],
      };
    case 'billing':
      return {
        reply: `${greet} for plan, trial, or billing issues: open License page, review active plan and expiry, then submit purchase/upgrade request. If trial is expired, activate a valid license key to unlock panels immediately.`,
        suggestions: [
          'Open License panel',
          'Check trial expiry date',
          'Submit purchase request',
        ],
        quick_actions: [{ label: 'Go to License', path: '/license' }],
      };
    case 'login':
      return {
        reply: `${greet} for login help: verify email/phone, use OTP if password fails, and ensure PIN login uses the registered device. If all methods fail, use forgot-password and reset credentials.`,
        suggestions: [
          'Try OTP login',
          'Use forgot password',
          'Verify PIN device',
        ],
        quick_actions: [],
      };
    case 'permissions':
      return {
        reply: `${greet} role permissions are managed in Role Management → Access. Set each panel to No Access, View, or Edit for the selected user, save, then ask that user to refresh session.`,
        suggestions: [
          'Open Role Management',
          'Edit section-level access',
          'Re-login affected user',
        ],
        quick_actions: [{ label: 'Open Roles', path: '/roles' }],
      };
    case 'orders':
      return {
        reply: `${greet} for order flow issues: check table assignment, send order to kitchen, confirm KDS ticket creation, then complete payment. If totals look wrong, verify service/tax settings in Restaurant Profile.`,
        suggestions: [
          'Verify table assignment',
          'Send to kitchen again',
          'Check tax/service config',
        ],
        quick_actions: [
          { label: 'Open POS', path: '/pos' },
          { label: 'Open Profile', path: '/profile' },
        ],
      };
    case 'menu':
      return {
        reply: `${greet} for menu updates: confirm category exists, item availability is enabled, and price is saved correctly. Refresh POS after saving menu changes.`,
        suggestions: [
          'Check item availability',
          'Validate category mapping',
          'Reload POS menu',
        ],
        quick_actions: [{ label: 'Open Menu', path: '/menu' }],
      };
    case 'reports':
      return {
        reply: `${greet} reports depend on paid orders. Ensure orders are marked paid, then check Reports filters (day/week/month/range). For print exports, run printer check first.`,
        suggestions: [
          'Confirm orders are paid',
          'Adjust report period',
          'Print report test',
        ],
        quick_actions: [{ label: 'Open Reports', path: '/reports' }],
      };
    default:
      return {
        reply: `${greet} I can help with login, printers, orders, menu, roles, and billing. Share the exact issue and the screen where it happens, and I’ll provide step-by-step guidance.`,
        suggestions: [
          'Printer issue',
          'Role permission issue',
          'Billing/trial issue',
          'Login issue',
        ],
        quick_actions: [],
      };
  }
}

router.post('/ask', async (req: AuthRequest, res, next) => {
  try {
    const data = AskSupportSchema.parse(req.body);
    const category = detectCategory(data.message);
    const payload = buildResponse({
      category,
      message: data.message,
      role: req.user?.role ?? 'unknown',
      screen: data.screen,
      name: req.user?.email,
    });
    res.json({
      category,
      ...payload,
      meta: {
        escalations_email: 'support@cafyz.com',
        response_mode: 'assistant-rag-lite',
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;

