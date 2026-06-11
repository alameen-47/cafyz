import { toast } from 'sonner';

// Shim so the ported api.ts (and any code expecting the old toast bus) routes
// through sonner, which web-v2 already uses for notifications.
export const toastBus = {
  success: (text: string) => toast.success(text),
  error: (text: string) => toast.error(text),
  info: (text: string) => toast(text),
};
