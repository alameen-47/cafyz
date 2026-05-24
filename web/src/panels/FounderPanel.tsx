import { useState, useEffect } from 'react';
import {
  founderApi, licensesApi,
  type ApiFounderRestaurant, type ApiFounderStats, type ApiLicenseKey, type ApiPlanConfig,
} from '../services/api';
import { PLAN_COLOR, PLAN_LABELS, ALL_PLAN_FEATURES, type Plan } from '../config/planAccess';
import './FounderPanel.css';

type Tab = 'overview' | 'restaurants' | 'licenses' | 'plan-config';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',    label: 'Overview' },
  { id: 'restaurants', label: 'Restaurants' },
  { id: 'licenses',    label: 'License Keys' },
  { id: 'plan-config', label: 'Plan Config' },
];

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ onTab }: { onTab: (t: Tab) => void }) {
  const [stats,   setStats]   = useState<ApiFounderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    founderApi.stats().then(setStats).catch(e => setError(e.message)).finally(() => setLoading(false));
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

  return (
    <div className="fdr-section">
      <p className="eyebrow">Network · All Tenants</p>
      <h1 className="serif fdr-title">Restaurants</h1>
      <p className="fdr-sub">{rests.length} restaurants on the platform</p>
      {error && <p className="fdr-error">{error}</p>}

      {loading ? <p className="fdr-loading">Loading…</p> : (
        <div className="card fdr-table">
          <div className="fdr-table-head">
            <span>Restaurant</span>
            <span>Slug</span>
            <span>Plan</span>
            <span>Users</span>
            <span>Active Key</span>
            <span>Change Plan</span>
          </div>
          {rests.map(r => (
            <div key={r.id} className="fdr-table-row">
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
  const [genExpiry, setGenExpiry]= useState('');
  const [justMade,  setJustMade] = useState<ApiLicenseKey[]>([]);

  useEffect(() => {
    licensesApi.list().then(setKeys).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function generate() {
    setGen(true); setError('');
    try {
      const res = await licensesApi.generate({ plan: genPlan, quantity: genQty, note: genNote || undefined, expires_at: genExpiry || undefined });
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
          <div className="fdr-gen-field">
            <label className="fdr-label">Expires (optional)</label>
            <input className="fdr-input" type="date" value={genExpiry}
              onChange={e => setGenExpiry(e.target.value)} />
          </div>
          <button className="btn-gold" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {justMade.length > 0 && (
          <div className="fdr-just-made">
            <p className="eyebrow" style={{ marginBottom: 8, color: 'var(--success)' }}>Generated — copy and send to client:</p>
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
                      <input className="fdr-input" type="number" value={draft.price_monthly ?? 0}
                        onChange={e => setDraft(d => ({ ...d, price_monthly: +e.target.value }))} style={{ width: 70 }} />
                    ) : `$${c.price_monthly}/mo`}
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
        {tab === 'restaurants' && <Restaurants />}
        {tab === 'licenses'    && <LicenseKeys />}
        {tab === 'plan-config' && <PlanConfig />}
      </div>
    </div>
  );
}
