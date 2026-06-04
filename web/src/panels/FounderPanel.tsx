import { useState, useEffect } from 'react';
import {
  founderApi, licensesApi,
  type ApiFounderInquiry, type ApiFounderRestaurant, type ApiFounderStats, type ApiLicenseKey,
  type ApiLicensePurchaseRequest, type ApiPlanConfig,
} from '../services/api';
import { PLAN_COLOR, PLAN_LABELS, ALL_PLAN_FEATURES, type Plan } from '../config/planAccess';
import './FounderPanel.css';

type Tab = 'overview' | 'inquiries' | 'license-requests' | 'restaurants' | 'licenses' | 'plan-config';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',    label: 'Overview' },
  { id: 'inquiries',   label: 'Trial Requests' },
  { id: 'license-requests', label: 'License Requests' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'licenses',    label: 'License Keys' },
  { id: 'plan-config', label: 'Plan Config' },
];

const CURRENCY_SYMBOL_OPTIONS = ['$', '€', '£', '₹', '¥', 'AED'];

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ onTab }: { onTab: (t: Tab) => void }) {
  const [stats,   setStats]   = useState<ApiFounderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    founderApi.stats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fdr-section">
      <p className="eyebrow">System · Platform Overview</p>
      <h1 className="serif fdr-title">Cafyz Control Center</h1>
      <p className="fdr-sub">You are logged in as the Cafyz Founder. Full system access.</p>

      {error && <p className="fdr-error">{error}</p>}

      {loading ? <p className="fdr-loading">Loading stats…</p> : stats && (
        <div className="fdr-overview-grid">
          <div className="fdr-stat card" onClick={() => onTab('restaurants')}>
            <p className="fdr-stat-num serif">
              {stats.restaurants_by_plan.reduce((s, r) => s + Number(r.count), 0)}
            </p>
            <p className="fdr-stat-label">Restaurants</p>
            <div className="fdr-plan-breakdown">
              {stats.restaurants_by_plan.map(r => (
                <span key={r.plan} className="fdr-plan-pip"
                  style={{ color: PLAN_COLOR[r.plan as Plan] ?? 'var(--text2)' }}>
                  {String(PLAN_LABELS[r.plan as Plan] ?? r.plan).toUpperCase()} ×{r.count}
                </span>
              ))}
            </div>
          </div>
          <div className="fdr-stat card" onClick={() => onTab('licenses')}>
            <p className="fdr-stat-num serif">{String((stats.license_keys as any)?.total ?? 0)}</p>
            <p className="fdr-stat-label">License Keys</p>
            <p className="fdr-stat-sub">{String((stats.license_keys as any)?.activated ?? 0)} activated</p>
          </div>
          <div className="fdr-stat card">
            <p className="fdr-stat-num serif">{String(stats.total_users)}</p>
            <p className="fdr-stat-label">Total Users</p>
            <p className="fdr-stat-sub">across all restaurants</p>
          </div>
          <div className="fdr-stat card" onClick={() => onTab('license-requests')}>
            <p className="fdr-stat-num serif">{String(stats.pending_license_requests ?? 0)}</p>
            <p className="fdr-stat-label">License Requests</p>
            <p className="fdr-stat-sub">pending fulfillment</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Restaurants ───────────────────────────────────────────────────────────────
function Restaurants() {
  const [rests,   setRests]   = useState<ApiFounderRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [busy,    setBusy]    = useState<string | null>(null);

  useEffect(() => {
    founderApi.restaurants().then(setRests).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function changePlan(id: string, plan: string) {
    setBusy(id); setError('');
    try {
      const updated = await founderApi.setPlan(id, plan);
      setRests(prev => prev.map(r => r.id === id ? { ...r, plan: (updated as any).plan } : r));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function deleteRestaurant(row: ApiFounderRestaurant) {
    const confirmDelete = window.confirm(
      `Delete restaurant "${row.name}"? This will permanently remove its users, orders, tables, menu, and related data.`,
    );
    if (!confirmDelete) return;

    setBusy(row.id); setError('');
    try {
      await founderApi.deleteRestaurant(row.id);
      setRests(prev => prev.filter(r => r.id !== row.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fdr-section">
      <p className="eyebrow">Network · All Tenants</p>
      <h1 className="serif fdr-title">Restaurants</h1>
      <p className="fdr-sub">{rests.length} restaurants on the platform</p>
      {error && <p className="fdr-error">{error}</p>}

      {loading ? <p className="fdr-loading">Loading…</p> : (
        <div className="card fdr-table">
          <div className="fdr-table-head fdr-rest-head">
            <span>Restaurant</span>
            <span>Slug</span>
            <span>Plan</span>
            <span>Users</span>
            <span>Active Key</span>
            <span>Change Plan</span>
            <span>Delete</span>
          </div>
          {rests.map(r => (
            <div key={r.id} className="fdr-table-row fdr-rest-row">
              <span className="fdr-rest-name">{r.name}</span>
              <span className="mono fdr-slug">{r.slug}</span>
              <span className="fdr-plan-pill"
                style={{ color: PLAN_COLOR[r.plan as Plan] ?? 'var(--text2)', background: (PLAN_COLOR[r.plan as Plan] ?? '#888') + '18' }}>
                {PLAN_LABELS[r.plan as Plan] ?? r.plan}
              </span>
              <span className="mono" style={{ fontSize: 13 }}>{r.user_count}</span>
              <span className="mono fdr-key-cell" style={{ fontSize: 11, color: r.active_key ? 'var(--success)' : 'var(--text3)' }}>
                {r.active_key ?? '—'}
              </span>
              <div className="fdr-plan-select-wrap">
                <select
                  className="fdr-plan-select"
                  value={r.plan}
                  disabled={busy === r.id}
                  onChange={e => changePlan(r.id, e.target.value)}
                >
                  {(['basic','pro','premium'] as Plan[]).map(p => (
                    <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                  ))}
                </select>
                {busy === r.id && <span className="fdr-busy">…</span>}
              </div>
              <div className="fdr-row-actions">
                <button
                  className="roles-del-btn"
                  onClick={() => deleteRestaurant(r)}
                  disabled={busy === r.id}
                >
                  {busy === r.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
          {rests.length === 0 && (
            <p className="fdr-empty">No restaurants yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── License Keys ──────────────────────────────────────────────────────────────
function LicenseKeys() {
  const [keys,      setKeys]     = useState<ApiLicenseKey[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [error,     setError]    = useState('');
  const [generating,setGen]      = useState(false);
  const [genPlan,   setGenPlan]  = useState<Plan>('pro');
  const [genQty,    setGenQty]   = useState(1);
  const [genNote,   setGenNote]  = useState('');
  const [genEmail,  setGenEmail] = useState('');
  const [genTrial,  setGenTrial]  = useState(true);
  const [genExpiry, setGenExpiry] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [justMade,  setJustMade] = useState<ApiLicenseKey[]>([]);

  useEffect(() => {
    licensesApi.list().then(setKeys).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGen(true); setError('');
    try {
      const res = await licensesApi.generate({
        plan: genPlan,
        quantity: genQty,
        note: genNote || undefined,
        recipient_email: genEmail.trim() || undefined,
        trial: genTrial,
        expires_at: genTrial && genExpiry ? new Date(genExpiry + 'T23:59:59Z').toISOString() : undefined,
      });
      const arr = Array.isArray(res) ? res : [res];
      setJustMade(arr);
      setKeys(prev => [...arr, ...prev]);
    } catch (e) { setError((e as Error).message); }
    finally { setGen(false); }
  }

  async function revoke(id: string) {
    try {
      await licensesApi.revoke(id);
      setKeys(prev => prev.map(k => k.id === id ? { ...k, is_active: 0 } : k));
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <div className="fdr-section">
      <p className="eyebrow">Licensing · Key Generation</p>
      <h1 className="serif fdr-title">License Keys</h1>
      {error && <p className="fdr-error">{error}</p>}

      {/* Generate form */}
      <div className="card fdr-gen-form">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Generate New Keys</p>
        <div className="fdr-gen-row">
          <div className="fdr-gen-field">
            <label className="fdr-label">Plan</label>
            <select className="fdr-select" value={genPlan} onChange={e => setGenPlan(e.target.value as Plan)}>
              {(['basic','pro','premium'] as Plan[]).map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
            </select>
          </div>
          <div className="fdr-gen-field">
            <label className="fdr-label">Quantity</label>
            <input className="fdr-input" type="number" min="1" max="50" value={genQty}
              onChange={e => setGenQty(Math.max(1, Math.min(50, +e.target.value)))} style={{ width: 70 }} />
          </div>
          <div className="fdr-gen-field" style={{ flex: 2 }}>
            <label className="fdr-label">Note (optional)</label>
            <input className="fdr-input" placeholder="e.g. For Café Nord Paris"
              value={genNote} onChange={e => setGenNote(e.target.value)} />
          </div>
          <div className="fdr-gen-field" style={{ flex: 2 }}>
            <label className="fdr-label">Recipient Email (optional)</label>
            <input
              className="fdr-input"
              type="email"
              placeholder="client@restaurant.com"
              value={genEmail}
              onChange={e => setGenEmail(e.target.value)}
            />
          </div>
          <div className="fdr-gen-field fdr-gen-trial">
            <label className="fdr-label">
              <input type="checkbox" checked={genTrial} onChange={e => setGenTrial(e.target.checked)} />
              {' '}7-day free trial
            </label>
            {genTrial && (
              <input className="fdr-input" type="date" value={genExpiry} title="Trial ends — billing after this date"
                onChange={e => setGenExpiry(e.target.value)} />
            )}
          </div>
          <button className="btn-gold" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {justMade.length > 0 && (
          <div className="fdr-just-made">
            <p className="eyebrow" style={{ marginBottom: 8, color: 'var(--success)' }}>Generated — copy and send to client:</p>
            {genEmail.trim() && (
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text2)' }}>
                Sent to: <span className="mono">{genEmail.trim()}</span>
              </p>
            )}
            {justMade.map(k => (
              <div key={k.id} className="fdr-new-key" onClick={() => navigator.clipboard?.writeText(k.key_code)}>
                <span className="mono fdr-new-key-code">{k.key_code}</span>
                <span className="fdr-plan-pill" style={{ color: PLAN_COLOR[k.plan as Plan], background: PLAN_COLOR[k.plan as Plan] + '22' }}>
                  {PLAN_LABELS[k.plan as Plan]}
                </span>
                <span className="fdr-copy-hint">click to copy</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Keys table */}
      {loading ? <p className="fdr-loading">Loading…</p> : (
        <div className="card fdr-table" style={{ marginTop: 20 }}>
          <div className="fdr-table-head fdr-keys-head">
            <span>Key Code</span><span>Plan</span><span>Status</span><span>Restaurant</span>
            <span>Activated</span><span>Expires</span><span>Note</span><span>Actions</span>
          </div>
          {keys.map(k => (
            <div key={k.id} className={`fdr-table-row fdr-keys-row ${!k.is_active ? 'revoked' : ''}`}>
              <span className="mono fdr-key-code">{k.key_code}</span>
              <span className="fdr-plan-pill" style={{ color: PLAN_COLOR[k.plan as Plan], background: PLAN_COLOR[k.plan as Plan] + '22' }}>
                {PLAN_LABELS[k.plan as Plan]}
              </span>
              <span className={`fdr-key-status ${k.restaurant_id ? 'used' : k.is_active ? 'free' : 'revoked'}`}>
                {k.restaurant_id ? 'Used' : k.is_active ? 'Available' : 'Revoked'}
              </span>
              <span className="fdr-key-rest" style={{ fontSize: 12, color: 'var(--text2)' }}>
                {k.restaurant_name ?? (k.restaurant_id ? '(restaurant deleted)' : '—')}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
                {k.activated_at ? new Date(k.activated_at).toLocaleDateString() : '—'}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
                {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : '∞'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k.note ?? '—'}</span>
              <div>
                {k.is_active && !k.restaurant_id && (
                  <button className="fdr-revoke-btn" onClick={() => revoke(k.id)}>Revoke</button>
                )}
              </div>
            </div>
          ))}
          {keys.length === 0 && <p className="fdr-empty">No keys yet.</p>}
        </div>
      )}
    </div>
  );
}

function LicenseRequests() {
  const [rows, setRows] = useState<ApiLicensePurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    founderApi.licenseRequests().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function fulfill(id: string) {
    setBusyId(id); setError('');
    try {
      const r = await founderApi.fulfillLicenseRequest(id);
      setRows(prev => prev.map(x => x.id === id ? { ...x, status: 'fulfilled' as const } : x));
      alert(`License sent to customer.\nKey: ${r.key_code}`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function cancel(id: string) {
    setBusyId(id); setError('');
    try {
      await founderApi.cancelLicenseRequest(id);
      setRows(prev => prev.map(x => x.id === id ? { ...x, status: 'cancelled' as const } : x));
    } catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  return (
    <div className="fdr-section">
      <p className="eyebrow">Licensing · Purchase Queue</p>
      <h1 className="serif fdr-title">License Purchase Requests</h1>
      <p className="fdr-sub">Managers request upgrades here. Fulfill to generate a key and email it to their address.</p>
      {error && <p className="fdr-error">{error}</p>}
      {loading ? <p className="fdr-loading">Loading…</p> : (
        <div className="card fdr-table">
          <div className="fdr-table-head">
            <span>Restaurant</span><span>Email</span><span>Plan</span><span>Status</span><span>Note</span><span>Actions</span>
          </div>
          {rows.map(r => (
            <div key={r.id} className="fdr-table-row">
              <span>{r.restaurant_name ?? '—'}</span>
              <span style={{ fontSize: 12 }}>{r.email}</span>
              <span className="mono">{r.plan.toUpperCase()}</span>
              <span className="mono" style={{ fontSize: 11 }}>{r.status}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.note ?? '—'}</span>
              <div className="fdr-row-actions">
                {r.status === 'pending' ? (
                  <>
                    <button className="roles-save-btn sm" onClick={() => fulfill(r.id)} disabled={busyId === r.id}>
                      {busyId === r.id ? '…' : 'Fulfill & Email'}
                    </button>
                    <button className="roles-del-btn" onClick={() => cancel(r.id)} disabled={busyId === r.id}>Cancel</button>
                  </>
                ) : <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="fdr-empty">No license requests yet.</p>}
        </div>
      )}
    </div>
  );
}

type ApprovalResult = {
  emailSent: boolean;
  userEmail: string;
  userPassword: string | null;
  licenseKey: string;
  alreadyProvisioned: boolean;
};

function Inquiries() {
  const [rows, setRows] = useState<ApiFounderInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [approvalResult, setApprovalResult] = useState<ApprovalResult | null>(null);

  useEffect(() => {
    founderApi.inquiries().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function act(id: string, status: 'approved'|'denied') {
    setBusyId(id); setError(''); setApprovalResult(null);
    try {
      const r = await founderApi.setInquiryStatus(id, status);
      setRows(prev => prev.map(x => x.id === id ? { ...x, status: r.status as ApiFounderInquiry['status'] } : x));
      if (status === 'approved') {
        setApprovalResult({
          emailSent:         r.emailSent ?? false,
          userEmail:         r.userEmail ?? '',
          userPassword:      r.userPassword ?? null,
          licenseKey:        r.licenseKey ?? '',
          alreadyProvisioned: r.alreadyProvisioned ?? false,
        });
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusyId(null); }
  }

  return (
    <div className="fdr-section">
      <p className="eyebrow">Onboarding · Trial Queue</p>
      <h1 className="serif fdr-title">Trial Requests</h1>
      <p className="fdr-sub">Approve to auto-create manager login and email credentials.</p>
      {error && <p className="fdr-error">{error}</p>}

      {approvalResult && (
        <div className={`fdr-approval-banner ${approvalResult.emailSent || approvalResult.alreadyProvisioned ? 'ok' : 'warn'}`}>
          {approvalResult.alreadyProvisioned ? (
            <p className="fdr-approval-msg">This account was already provisioned. The user can sign in at their existing credentials.</p>
          ) : approvalResult.emailSent ? (
            <p className="fdr-approval-msg ok-text">
              ✓ Credentials emailed to <strong>{approvalResult.userEmail}</strong>
            </p>
          ) : (
            <>
              <p className="fdr-approval-warn">
                ⚠ Applicant did not receive email (verify ametronyx.com on Resend). A copy was sent to your founder inbox — forward these credentials:
              </p>
              <table className="fdr-cred-table">
                <tbody>
                  <tr>
                    <td>Email</td>
                    <td><code>{approvalResult.userEmail}</code></td>
                  </tr>
                  <tr>
                    <td>Password</td>
                    <td><code>{approvalResult.userPassword}</code></td>
                  </tr>
                  <tr>
                    <td>License key</td>
                    <td><code>{approvalResult.licenseKey}</code></td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
          <button type="button" className="fdr-dismiss-btn" onClick={() => setApprovalResult(null)}>
            Dismiss
          </button>
        </div>
      )}

      {loading ? <p className="fdr-loading">Loading…</p> : (
        <div className="card fdr-table">
          <div className="fdr-table-head">
            <span>Restaurant</span><span>Contact</span><span>Plan</span><span>Type</span><span>Status</span><span>Actions</span>
          </div>
          {rows.map(r => (
            <div key={r.id} className="fdr-table-row">
              <span>{r.restaurant_name}</span>
              <span style={{ fontSize: 12 }}>{r.name} · {r.email}</span>
              <span className="mono">{r.plan.toUpperCase()}</span>
              <span style={{ color: r.is_retry ? 'var(--warning,#facc15)' : 'var(--text2)' }}>{r.is_retry ? 'Retry' : 'New'}</span>
              <span className="mono" style={{ fontSize: 11 }}>{r.status}</span>
              <div className="fdr-row-actions">
                {r.status === 'pending' ? (
                  <>
                    <button className="roles-save-btn sm" onClick={() => act(r.id, 'approved')} disabled={busyId === r.id}>Approve</button>
                    <button className="roles-del-btn" onClick={() => act(r.id, 'denied')} disabled={busyId === r.id}>Deny</button>
                  </>
                ) : <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="fdr-empty">No trial requests yet.</p>}
        </div>
      )}
    </div>
  );
}

// ── Plan Config ───────────────────────────────────────────────────────────────
function PlanConfig() {
  const [configs,  setConfigs]  = useState<ApiPlanConfig[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [editPlan, setEditPlan] = useState<string | null>(null);
  const [draft,    setDraft]    = useState<Partial<ApiPlanConfig>>({});
  const [busy,     setBusy]     = useState(false);

  useEffect(() => {
    founderApi.planConfig().then(setConfigs).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  function startEdit(c: ApiPlanConfig) {
    setEditPlan(c.plan); setDraft({ ...c });
  }

  async function save() {
    if (!editPlan) return;
    setBusy(true); setError('');
    try {
      const panels = (draft.panels_json ?? '[]');
      const updated = await founderApi.updatePlanConfig(editPlan, {
        panels_json:   panels,
        label:         draft.label,
        description:   draft.description,
        price_monthly: draft.price_monthly,
        currency_symbol: draft.currency_symbol,
      });
      setConfigs(prev => prev.map(c => c.plan === editPlan ? updated : c));
      setEditPlan(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const ALL_SCREENS = ['pos','menu','waiter','kds','manager','inventory','staff','reports','roles','license'];

  return (
    <div className="fdr-section">
      <p className="eyebrow">Access · Feature Gates</p>
      <h1 className="serif fdr-title">Plan Configuration</h1>
      <p className="fdr-sub">Define which panels each plan can access. Changes take effect on next login.</p>
      {error && <p className="fdr-error">{error}</p>}

      {loading ? <p className="fdr-loading">Loading…</p> : (
        <div className="fdr-plan-config-grid">
          {configs.map(c => {
            const isEditing = editPlan === c.plan;
            const panels: string[] = isEditing
              ? (() => { try { return JSON.parse(draft.panels_json ?? '[]'); } catch { return []; } })()
              : (() => { try { return JSON.parse(c.panels_json); } catch { return []; } })();

            return (
              <div key={c.plan} className="card fdr-config-card"
                style={{ '--plan-color': PLAN_COLOR[c.plan as Plan] } as React.CSSProperties}>
                <div className="fdr-config-head">
                  <span className="serif fdr-config-name" style={{ color: PLAN_COLOR[c.plan as Plan] }}>
                    {isEditing ? (
                      <input className="fdr-input" value={draft.label ?? ''} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} style={{ width: 100 }} />
                    ) : c.label}
                  </span>
                  <span className="fdr-config-price mono">
                    {isEditing ? (
                      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <select
                          className="fdr-select"
                          value={draft.currency_symbol ?? c.currency_symbol ?? '$'}
                          onChange={e => setDraft(d => ({ ...d, currency_symbol: e.target.value }))}
                          style={{ width: 72 }}
                        >
                          {CURRENCY_SYMBOL_OPTIONS.map(sym => (
                            <option key={sym} value={sym}>{sym}</option>
                          ))}
                        </select>
                        <input className="fdr-input" type="number" value={draft.price_monthly ?? 0}
                          onChange={e => setDraft(d => ({ ...d, price_monthly: +e.target.value }))} style={{ width: 90 }} />
                        <span>/mo</span>
                      </span>
                    ) : `${c.currency_symbol ?? '$'}${c.price_monthly}/mo`}
                  </span>
                </div>

                {isEditing ? (
                  <textarea className="fdr-desc-input" value={draft.description ?? ''}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={2} />
                ) : (
                  <p className="fdr-config-desc">{c.description}</p>
                )}

                <div className="fdr-config-panels">
                  {ALL_SCREENS.map(screen => {
                    const hasIt = panels.includes(screen);
                    const feat = ALL_PLAN_FEATURES.find(f => f.id === screen);
                    return (
                      <label key={screen} className={`fdr-panel-toggle ${hasIt ? 'on' : 'off'} ${!isEditing ? 'readonly' : ''}`}>
                        <input
                          type="checkbox"
                          checked={hasIt}
                          disabled={!isEditing}
                          onChange={e => {
                            const newPanels = e.target.checked ? [...panels, screen] : panels.filter(p => p !== screen);
                            setDraft(d => ({ ...d, panels_json: JSON.stringify(newPanels) }));
                          }}
                        />
                        <span>{feat?.label ?? screen}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="fdr-config-actions">
                  {isEditing ? (
                    <>
                      <button className="roles-save-btn" onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</button>
                      <button className="roles-cancel-btn" onClick={() => setEditPlan(null)}>Cancel</button>
                    </>
                  ) : (
                    <button className="roles-edit-btn" onClick={() => startEdit(c)}>Edit Plan</button>
                  )}
                </div>
              </div>
            );
          })}
          {configs.length === 0 && (
            <div className="card" style={{ padding: 16 }}>
              <p className="eyebrow">No plan config found</p>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
                Plan configuration is not initialized yet. Restart backend once to auto-bootstrap default plan config.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Founder Panel Shell ───────────────────────────────────────────────────────
export function FounderPanel() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="fdr-root">
      <div className="fdr-tabs">
        {TABS.map(t => (
          <button key={t.id}
            className={`fdr-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="fdr-body">
        {tab === 'overview'    && <Overview    onTab={setTab} />}
        {tab === 'inquiries'   && <Inquiries />}
        {tab === 'license-requests' && <LicenseRequests />}
        {tab === 'restaurants' && <Restaurants />}
        {tab === 'licenses'    && <LicenseKeys />}
        {tab === 'plan-config' && <PlanConfig />}
      </div>
    </div>
  );
}
