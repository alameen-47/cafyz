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
                {isCurrent && <span className="upgrade-badge" style={{ background: 'var(--bg3)', color: 'var(--text2)' }}>Current</span>}
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
          <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
            Contact <b style={{ color: 'var(--text0)' }}>founder@cafyz.io</b> or activate a license key
            to upgrade your plan.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
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

      <style>{`
        .upgrade-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(7,6,15,0.85);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          backdrop-filter: blur(4px);
        }
        .upgrade-modal {
          background: var(--bg1,#0E0B1C);
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 16px;
          width: 100%; max-width: 620px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.6);
        }
        .upgrade-header {
          padding: 28px 28px 20px;
          border-bottom: 1px solid var(--line,rgba(255,255,255,0.06));
          position: relative;
        }
        .upgrade-close {
          position: absolute; top: 16px; right: 16px;
          background: none; border: none; color: var(--text2,#8A8A9A);
          font-size: 16px; cursor: pointer; padding: 4px 8px;
          border-radius: 4px;
        }
        .upgrade-close:hover { color: var(--text0,#F5F5F0); }
        .upgrade-title { font-size: 22px; margin: 6px 0 8px; color: var(--text0,#F5F5F0); }
        .upgrade-sub { font-size: 13px; color: var(--text2,#8A8A9A); }
        .upgrade-plans {
          display: flex; gap: 12px; padding: 20px 28px;
          overflow-x: auto;
        }
        .upgrade-plan-card {
          flex: 1; min-width: 160px;
          background: var(--bg2,#0A0816);
          border: 1px solid var(--line,rgba(255,255,255,0.06));
          border-radius: 10px; padding: 16px;
          position: relative;
          transition: border-color 0.15s;
        }
        .upgrade-plan-card.recommended {
          border-color: var(--plan-color,#8B5CF6);
          background: rgba(139,92,246,0.06);
        }
        .upgrade-badge {
          display: inline-block; font-size: 10px; font-weight: 600;
          background: var(--plan-color,#8B5CF6);
          color: #fff; border-radius: 4px;
          padding: 2px 7px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em;
        }
        .upgrade-plan-name { font-size: 16px; color: var(--text0,#F5F5F0); margin: 0 0 2px; }
        .upgrade-plan-price { font-size: 13px; color: var(--plan-color,#8B5CF6); margin: 0 0 10px; font-weight: 600; }
        .upgrade-features { list-style: none; padding: 0; margin: 0; }
        .upgrade-features li { font-size: 12px; color: var(--text2,#8A8A9A); margin-bottom: 4px; }
        .upgrade-footer {
          padding: 16px 28px 24px;
          border-top: 1px solid var(--line,rgba(255,255,255,0.06));
        }
      `}</style>
    </div>
  );
}
