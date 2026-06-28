import { useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Crown, Zap, Shield } from 'lucide-react';
import { useAuth, type Plan } from '../auth';
import { PAGE_LABELS, PLAN_ORDER, type PageId } from '../../config/access';
import { usePlanConfig } from '../PlanConfigProvider';
import { formatPlanPrice, formatBillingSuffix, getPlanConfig } from '../../services/planConfigStore';

const PLAN_META: Record<Plan, { label: string; color: string; icon: typeof Shield }> = {
  basic: { label: 'Basic', color: 'var(--cafyz-muted)', icon: Shield },
  pro: { label: 'Pro', color: '#1e7fff', icon: Zap },
  premium: { label: 'Premium', color: '#a855f7', icon: Crown },
};

interface Props {
  requiredPlan: Plan;
  featurePage?: PageId;
  onClose: () => void;
  onGoLicense: () => void;
}

export function UpgradeModal({ requiredPlan, featurePage, onClose, onGoLicense }: Props) {
  const { user } = useAuth();
  const { plans } = usePlanConfig();
  const currentPlan = (user?.plan ?? 'basic') as Plan;
  const featureLabel = featurePage ? PAGE_LABELS[featurePage] : PLAN_META[requiredPlan].label;
  const plansToShow = PLAN_ORDER.filter(p => PLAN_ORDER.indexOf(p) >= PLAN_ORDER.indexOf(requiredPlan));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'var(--cafyz-overlay)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl p-6"
        style={{ background: 'var(--cafyz-surface)', border: '1px solid rgba(30,127,255,0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p style={{ color: 'var(--cafyz-muted)', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Upgrade required</p>
            <h2 style={{ color: 'var(--cafyz-text)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', marginTop: 6 }}>
              Unlock {featureLabel}
            </h2>
            <p style={{ color: 'var(--cafyz-muted)', fontSize: '0.82rem', marginTop: 6 }}>
              Your {PLAN_META[currentPlan].label} plan does not include this feature. Upgrade to {PLAN_META[requiredPlan].label} or activate a license key.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--cafyz-muted)' }}><X size={16} /></button>
        </div>

        <div className="space-y-2 mb-5">
          {plansToShow.map(plan => {
            const Meta = PLAN_META[plan];
            const Icon = Meta.icon;
            const cfg = getPlanConfig(plan) ?? plans.find(p => p.plan === plan);
            const priceLine = cfg ? `${formatPlanPrice(cfg)}${formatBillingSuffix(cfg)}` : null;
            return (
              <div key={plan} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: plan === requiredPlan ? 'var(--cafyz-accent-bg)' : 'var(--cafyz-subtle-bg)', border: `1px solid ${plan === requiredPlan ? 'var(--cafyz-accent-border)' : 'var(--cafyz-border)'}` }}>
                <Icon size={16} style={{ color: Meta.color }} />
                <div className="min-w-0 flex-1">
                  <span style={{ color: 'var(--cafyz-text)', fontWeight: 600, fontSize: '0.85rem' }}>{cfg?.label ?? Meta.label}</span>
                  {priceLine && <p style={{ color: 'var(--cafyz-muted)', fontSize: '0.68rem', marginTop: 2 }}>{priceLine}</p>}
                </div>
                {plan === currentPlan && <span style={{ color: 'var(--cafyz-muted)', fontSize: '0.68rem' }}>Current</span>}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm" style={{ background: 'var(--cafyz-subtle-bg)', color: 'var(--cafyz-text-secondary)', border: '1px solid var(--cafyz-border)' }}>Maybe later</button>
          <button onClick={() => { onGoLicense(); onClose(); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #1e7fff, #00c6ff)', color: '#fff' }}>
            Activate license →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
