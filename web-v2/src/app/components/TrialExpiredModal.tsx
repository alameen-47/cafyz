import { motion } from 'motion/react';
import { Clock, Mail, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from './Toast';
import { licensesApi } from '../../services/api';
import type { Plan } from '../auth';

interface Props {
  expiresAt?: string | null;
  founderEmail?: string | null;
  currentPlan?: Plan;
  onGoLicense: () => void;
  onRenewalSubmitted?: () => void;
  /** Staff/waiter/kitchen — no plan UI, contact manager instead. */
  staffMode?: boolean;
}

export function TrialExpiredModal({
  expiresAt, founderEmail, currentPlan = 'basic', onGoLicense, onRenewalSubmitted, staffMode = false,
}: Props) {
  const [requesting, setRequesting] = useState(false);
  const expiryLabel = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;
  const email = founderEmail ?? 'cafyzofficial@gmail.com';

  const contactRenewal = async () => {
    setRequesting(true);
    try {
      await licensesApi.requestPurchase({ plan: currentPlan });
      toast.success('Renewal request sent', `Cafyz (${email}) will email you when your renewal is approved.`);
      onRenewalSubmitted?.();
    } catch (e) {
      toast.error("Couldn't send request", (e as Error).message);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[max(5rem,env(safe-area-inset-top))]" style={{ background: 'var(--cafyz-overlay)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: 'var(--cafyz-surface)', border: '1px solid rgba(255,59,92,0.25)', boxShadow: 'var(--cafyz-shadow-lg)' }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,59,92,0.12)' }}>
            <Clock size={22} style={{ color: '#ff3b5c' }} />
          </div>
          <div>
            <h2 style={{ color: 'var(--cafyz-text)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem' }}>
              {staffMode ? 'Restaurant subscription expired' : 'Renew your Cafyz subscription'}
            </h2>
            <p style={{ color: 'var(--cafyz-muted)', fontSize: '0.82rem', marginTop: 6, lineHeight: 1.55 }}>
              {staffMode
                ? `Your restaurant's trial or license ended${expiryLabel ? ` on ${expiryLabel}` : ''}. Contact your manager or owner to renew — you cannot access the system until they do.`
                : `Your trial or license ended${expiryLabel ? ` on ${expiryLabel}` : ''}. Contact Cafyz to renew — your restaurant data is safe.`}
            </p>
          </div>
        </div>

        {!staffMode && (
          <>
            <div className="rounded-xl px-4 py-3 mb-4" style={{ background: 'var(--cafyz-surface-2)', border: '1px solid var(--cafyz-border)' }}>
              <p style={{ color: 'var(--cafyz-text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                Email:{' '}
                <a href={`mailto:${email}`} style={{ color: '#1e7fff', fontWeight: 600 }}>{email}</a>
              </p>
              <p style={{ color: 'var(--cafyz-muted)', fontSize: '0.72rem', marginTop: 6 }}>
                Tap below to send a renewal request. The founder receives Approve / Deny links by email.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => void contactRenewal()}
                disabled={requesting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, #1e7fff, #00c6ff)', color: '#fff', opacity: requesting ? 0.7 : 1 }}
              >
                {requesting ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                {requesting ? 'Sending…' : 'Contact Cafyz to renew'}
              </button>
              <button
                type="button"
                onClick={onGoLicense}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--cafyz-subtle-bg)', color: 'var(--cafyz-brand)', border: '1px solid var(--cafyz-accent-border)' }}
              >
                License & plans
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
