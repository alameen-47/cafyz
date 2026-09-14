import { motion } from 'motion/react';
import { Clock, Mail, Loader2, Key, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from './Toast';
import { licensesApi } from '../../services/api';
import type { Plan } from '../auth';

interface Props {
  expiresAt?: string | null;
  founderEmail?: string | null;
  currentPlan?: Plan;
  onGoLicense: () => void;
  /** Called after a renewal request or a successful key activation, so the app re-checks access. */
  onRenewalSubmitted?: () => void;
  /** Staff/waiter/kitchen — no plan UI, contact manager instead. */
  staffMode?: boolean;
  /** The lapsed licence was the free trial rather than a founder-issued key. */
  onTrial?: boolean;
}

export function TrialExpiredModal({
  expiresAt, founderEmail, currentPlan = 'basic', onGoLicense, onRenewalSubmitted, staffMode = false, onTrial = false,
}: Props) {
  const [requesting, setRequesting] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const expiryLabel = expiresAt ? new Date(expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  const email = founderEmail ?? 'cafyzofficial@gmail.com';
  const ended = onTrial ? 'free trial' : 'license';

  const requestKey = async () => {
    setRequesting(true);
    try {
      await licensesApi.requestPurchase({ plan: currentPlan });
      toast.success('License key requested', 'Cafyz will email your key. Enter it here when it arrives.');
      onRenewalSubmitted?.();
    } catch (e) {
      const msg = (e as Error).message;
      if (/pending/i.test(msg)) toast.info('Already requested', 'Your key is on its way — check your email.');
    } finally {
      setRequesting(false);
    }
  };

  const activate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    try {
      const res = await licensesApi.activate(licenseKey.trim());
      toast.success('License activated', `Welcome back — your ${String(res.plan).toUpperCase()} plan is active.`);
      onRenewalSubmitted?.();
    } catch {
      // The API client already shows why the key was rejected.
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[max(5rem,env(safe-area-inset-top))] overflow-y-auto" style={{ background: 'var(--cafyz-overlay)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: 'var(--cafyz-surface)', border: '1px solid var(--cafyz-border-strong)', boxShadow: 'var(--cafyz-shadow-lg)' }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.12)' }}>
            <Clock size={22} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h2 style={{ color: 'var(--cafyz-text)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem' }}>
              {staffMode ? 'Restaurant access is paused' : `Your ${ended} has ended`}
            </h2>
            <p style={{ color: 'var(--cafyz-muted)', fontSize: '0.82rem', marginTop: 6, lineHeight: 1.55 }}>
              {staffMode
                ? `Your restaurant's ${ended} ended${expiryLabel ? ` on ${expiryLabel}` : ''}. Ask your owner or manager to activate a license key — everything will be right where you left it.`
                : `It ended${expiryLabel ? ` on ${expiryLabel}` : ''}. Your restaurant data is safe. Enter your license key from Cafyz to continue right where you left off.`}
            </p>
          </div>
        </div>

        {!staffMode && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label style={{ color: 'var(--cafyz-text-secondary)', fontSize: '0.78rem', display: 'block' }}>License key</label>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl px-3" style={{ background: 'var(--cafyz-surface-2)', border: '1px solid var(--cafyz-accent-border)' }}>
                  <Key size={15} style={{ color: 'var(--cafyz-muted)', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') void activate(); }}
                    placeholder="CAFYZ-XXX-XXXXXXXX"
                    className="flex-1 min-w-0 bg-transparent outline-none py-3 text-sm placeholder:text-[var(--cafyz-muted)]"
                    style={{ color: 'var(--cafyz-text)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void activate()}
                  disabled={!licenseKey.trim() || activating}
                  className="px-4 rounded-xl text-sm font-semibold flex items-center gap-1.5 flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1e7fff, #00c6ff)', color: '#fff', opacity: (!licenseKey.trim() || activating) ? 0.6 : 1 }}
                >
                  {activating ? <Loader2 size={16} className="animate-spin" /> : <>Activate <ArrowRight size={15} /></>}
                </button>
              </div>
            </div>

            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--cafyz-surface-2)', border: '1px solid var(--cafyz-border)' }}>
              <p style={{ color: 'var(--cafyz-text)', fontSize: '0.82rem', fontWeight: 600 }}>Don&apos;t have a key yet?</p>
              <p style={{ color: 'var(--cafyz-muted)', fontSize: '0.74rem', marginTop: 3, lineHeight: 1.5 }}>
                Request one and Cafyz will email it to you, or write to{' '}
                <a href={`mailto:${email}`} style={{ color: '#1e7fff', fontWeight: 600 }}>{email}</a>.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => void requestKey()}
                  disabled={requesting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--cafyz-subtle-bg)', color: 'var(--cafyz-brand)', border: '1px solid var(--cafyz-accent-border)', opacity: requesting ? 0.7 : 1 }}
                >
                  {requesting ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                  {requesting ? 'Requesting…' : 'Request license key'}
                </button>
                <button
                  type="button"
                  onClick={onGoLicense}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ color: 'var(--cafyz-text-secondary)', border: '1px solid var(--cafyz-border)' }}
                >
                  See plans
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
