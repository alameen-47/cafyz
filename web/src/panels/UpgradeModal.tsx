/**
 * UpgradeModal — shown when a user taps a feature gated behind a higher plan.
 *
 * Usage:
 *   <UpgradeModal
 *     requiredPlan="pro"
 *     featureLabel="Kitchen Display (KDS)"
 *     onClose={() => setShowUpgrade(false)}
 *   />
 */
import { ALL_PLAN_FEATURES, PLAN_COLOR, PLAN_LABELS, type Plan } from '../config/planAccess';
import { useAuth } from '../context/AuthContext';
import './UpgradeModal.css';

interface Props {
  requiredPlan: Plan;
  featureLabel?: string;
  onClose: () => void;
}

const PLAN_PRICE: Record<Plan, string> = {
  basic:   '€49 / mo',
  pro:     '€99 / mo',
  premium: '€199 / mo',
};

const PLAN_ORDER: Plan[] = ['basic', 'pro', 'premium'];

export function UpgradeModal({ requiredPlan, featureLabel, onClose }: Props) {
  const { user } = useAuth();
  const currentPlan = (user?.plan ?? 'basic') as Plan;

  const plansToShow = PLAN_ORDER.filter(p => PLAN_ORDER.indexOf(p) >= PLAN_ORDER.indexOf(requiredPlan));

  return (
    <div className="upgrade-overlay" onClick={onClose}>
      <div className="upgrade-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="upgrade-header">
          <button className="upgrade-close" onClick={onClose} aria-label="Close">✕</button>
          <p className="eyebrow">Plan Required</p>
          <h2 className="serif upgrade-title">
            {featureLabel
              ? <>Unlock <span style={{ color: PLAN_COLOR[requiredPlan] }}>{featureLabel}</span></>
              : <>Upgrade to <span style={{ color: PLAN_COLOR[requiredPlan] }}>{PLAN_LABELS[requiredPlan]}</span></>
            }
          </h2>
          <p className="upgrade-sub">
            Your current plan is&nbsp;
            <b style={{ color: PLAN_COLOR[currentPlan] }}>{PLAN_LABELS[currentPlan]}</b>.
            This feature requires&nbsp;
            <b style={{ color: PLAN_COLOR[requiredPlan] }}>{PLAN_LABELS[requiredPlan]}</b> or higher.
          </p>
        </div>

        {/* Plan cards */}
        <div className="upgrade-plans">
          {plansToShow.map(plan => {
            const isCurrent = plan === currentPlan;
            const features = ALL_PLAN_FEATURES.filter(f => f.plans.includes(plan));
            return (
              <div
                key={plan}
                className={`upgrade-plan-card ${plan === requiredPlan ? 'recommended' : ''} ${isCurrent ? 'current' : ''}`}
                style={{ '--plan-color': PLAN_COLOR[plan] } as React.CSSProperties}
              >
                {plan === requiredPlan && !isCurrent && (
                  <span className="upgrade-badge">Recommended</span>
                )}
                {isCurrent && <span className="upgrade-badge current">Current</span>}
                <p className="upgrade-plan-name serif">{PLAN_LABELS[plan]}</p>
                <p className="upgrade-plan-price">{PLAN_PRICE[plan]}</p>
                <ul className="upgrade-features">
                  {features.map(f => (
                    <li key={f.id}>✓ {f.label}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="upgrade-footer">
          <p className="upgrade-footer-note">
            Contact <b style={{ color: 'var(--text0)' }}>founder@cafyz.io</b> or activate a license key
            to upgrade your plan.
          </p>
          <div className="upgrade-footer-actions">
            <button className="btn-outline" onClick={onClose}>Maybe later</button>
            <button
              className="btn-gold"
              onClick={() => { window.location.href = '/license'; }}
            >
              Activate License Key →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
