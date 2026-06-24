import { toast } from 'sonner';
import { tt } from '../i18n/translateToast';

// Shim so the ported api.ts (and any code expecting the old toast bus) routes
// through sonner, which web-v2 already uses for notifications.
export const toastBus = {
  success: (text: string) => toast.success(tt(text)),
  error: (text: string) => toast.error(tt(text)),
  info: (text: string) => toast(tt(text)),
};
