import { useState, useEffect } from 'react';
import { licensesApi, type ApiLicenseKey, type ApiLicensePurchaseRequest } from '../services/api';
import { PLAN_LABELS, type Plan } from '../config/planAccess';
import { useAuth } from '../context/AuthContext';
import { ALL_PLAN_FEATURES, PLAN_COLOR } from '../config/planAccess';
import './LicensePanel.css';

export function LicensePanel() {
  const { user, refreshPlan } = useAuth();
  const [keyInput,   setKeyInput]   = useState('');
  const [info,       setInfo]       = useState<{ plan: string; license: ApiLicenseKey | null } | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [activating, setActivating] = useState(false);
  const [success,    setSuccess]    = useState('');
  const [error,      setError]      = useState('');
  const [requests,   setRequests]   = useState<ApiLicensePurchaseRequest[]>([]);
  const [reqPlan,    setReqPlan]    = useState<Plan>('pro');
  const [reqEmail,   setReqEmail]   = useState('');
  const [reqNote,    setReqNote]    = useState('');
  const [reqBusy,    setReqBusy]    = useState(false);
  const [reqSuccess, setReqSuccess] = useState('');

  const canActivate = user?.role === 'owner' || user?.role === 'manager';
  const currentPlan = (info?.plan ?? user?.plan ?? 'basic') as Plan;

  useEffect(() => {
    Promise.all([licensesApi.mine(), canActivate ? licensesApi.myPurchaseRequests() : Promise.resolve([])])
      .then(([mine, reqs]) => {
        setInfo(mine);
        setRequests(reqs);
        if (user?.email) setReqEmail(user.email);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user?.email, canActivate]);

  async function requestPurchase() {
    setReqBusy(true); setError(''); setReqSuccess('');
    try {
      const r = await licensesApi.requestPurchase({
        plan: reqPlan,
        email: reqEmail.trim() || undefined,
        note: reqNote.trim() || undefined,
      });
      setReqSuccess(`Purchase request sent. The founder will email your license key to ${r.email}.`);
      setReqNote('');
      const reqs = await licensesApi.myPurchaseRequests();
      setRequests(reqs);
    } catch (e) { setError((e as Error).message); }
    finally { setReqBusy(false); }
  }

  async function activate() {
    if (!keyInput.trim()) return;
    setActivating(true); setError(''); setSuccess('');
    try {
      const res = await licensesApi.activate(keyInput.trim());
      setSuccess(`Plan upgraded to ${res.plan.toUpperCase()} — reloading…`);
      setKeyInput('');
      await refreshPlan();
      const fresh = await licensesApi.mine();
      setInfo(fresh);
      setSuccess(`Successfully activated ${res.plan.toUpperCase()} plan.`);
    } catch (e) { setError((e as Error).message); }
    finally { setActivating(false); }
  }

  return (
    <div className="lic-root">
      <div className="lic-header">
        <div>
          <p className="eyebrow">Subscription · Plan Access</p>
          <h1 className="serif lic-title">License &amp; Plan</h1>
          <p className="lic-sub">
            Your restaurant runs on the&nbsp;
            <span className="lic-badge" style={{ background: PLAN_COLOR[currentPlan] + '22', color: PLAN_COLOR[currentPlan] }}>
              {PLAN_LABELS[currentPlan]}
            </span>
            &nbsp;plan.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="lic-loading">Loading license info…</p>
      ) : (
        <>
          {/* Current license info */}
          {info?.license && (
            <div className="lic-active-card card">
              <div className="lic-active-top">
                <p className="eyebrow">Active License</p>
                <span className="lic-key-code mono">{info.license.key_code}</span>
              </div>
              <div className="lic-active-meta">
                <span>Activated: <b>{info.license.activated_at ? new Date(info.license.activated_at).toLocaleDateString() : '—'}</b></span>
                {info.license.expires_at && (
                  <span>Expires: <b>{new Date(info.license.expires_at).toLocaleDateString()}</b></span>
                )}
              </div>
            </div>
          )}

          {/* Activate key form */}
          {canActivate && (
            <div className="lic-activate-card card lic-purchase-card">
              <p className="eyebrow lic-section-label">Request License Purchase</p>
              <p className="lic-section-desc">
                Request a plan upgrade. The founder will be notified and email your license key to the address below.
              </p>
              <div className="lic-purchase-row">
                <select className="lic-input lic-purchase-select" value={reqPlan} onChange={e => setReqPlan(e.target.value as Plan)}>
                  {(['basic','pro','premium'] as Plan[]).map(p => (
                    <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                  ))}
                </select>
                <input
                  className="lic-input lic-purchase-email"
                  type="email"
                  placeholder="Delivery email"
                  value={reqEmail}
                  onChange={e => setReqEmail(e.target.value)}
                />
              </div>
              <input
                className="lic-input lic-full-width"
                placeholder="Note for founder (optional)"
                value={reqNote}
                onChange={e => setReqNote(e.target.value)}
              />
              <button className="btn-outline lic-request-btn" onClick={requestPurchase} disabled={reqBusy || !reqEmail.trim()}>
                {reqBusy ? 'Sending…' : 'Request Purchase'}
              </button>
              {reqSuccess && <p className="lic-success lic-success-spaced">{reqSuccess}</p>}
              {requests.length > 0 && (
                <div className="lic-request-list">
                  <p className="eyebrow lic-requests-label">Your requests</p>
                  {requests.map(r => (
                    <div key={r.id} className="lic-request-item">
                      {PLAN_LABELS[r.plan as Plan] ?? r.plan} · <span className="mono">{r.status}</span>
                      {r.fulfilled_at && ` · ${new Date(r.fulfilled_at).toLocaleDateString()}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {canActivate && (
            <div className="lic-activate-card card">
              <p className="eyebrow lic-section-label">Activate License Key</p>
              <p className="lic-section-desc">
                Enter a license key provided by Cafyz to upgrade your plan.
              </p>
              <div className="lic-form-row">
                <input
                  className="lic-input mono"
                  placeholder="CAFYZ-PRO-XXXXXXXX"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && activate()}
                  disabled={activating}
                />
                <button className="btn-gold lic-activate-btn" onClick={activate} disabled={activating || !keyInput.trim()}>
                  {activating ? 'Activating…' : 'Activate'}
                </button>
              </div>
              {error   && <p className="lic-error">{error}</p>}
              {success && <p className="lic-success">{success}</p>}
            </div>
          )}

          {/* Plan comparison */}
          <div className="lic-plans-grid">
            {(['basic','pro','premium'] as Plan[]).map(plan => {
              const isCurrent = plan === currentPlan;
              return (
                <div key={plan} className={`lic-plan-card card ${isCurrent ? 'current' : ''}`}
                  style={{ '--plan-color': PLAN_COLOR[plan] } as React.CSSProperties}>
                  {isCurrent && <span className="lic-current-badge">Current Plan</span>}
                  <p className="lic-plan-name serif">{PLAN_LABELS[plan]}</p>
                  <ul className="lic-features-list">
                    {ALL_PLAN_FEATURES.map(f => {
                      const included = f.plans.includes(plan);
                      return (
                        <li key={f.id} className={`lic-feature-item ${included ? 'yes' : 'no'}`}>
                          <span className="lic-feature-dot">{included ? '✓' : '○'}</span>
                          {f.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="lic-contact-note">
            Managers can request a purchase above or activate a key sent by the founder.
          </p>
        </>
      )}
    </div>
  );
}
