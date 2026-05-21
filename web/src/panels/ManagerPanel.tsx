import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dashboardApi, inventoryApi, usersApi, reservationsApi,
  type ApiDashboardStats, type ApiInventoryItem, type ApiUser, type ApiReservation,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RolesPanel } from './RolesPanel';
import './ManagerPanel.css';

type Section = 'overview' | 'inventory' | 'staff' | 'reports' | 'roles';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview',  label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'staff',     label: 'Staff' },
  { id: 'reports',   label: 'Reports' },
  { id: 'roles',     label: 'Role Management' },
];

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ onNav }: { onNav: (s: Section) => void }) {
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [clock,    setClock]  = useState('');
  const [stats,    setStats]  = useState<ApiDashboardStats | null>(null);
  const [res,      setRes]    = useState<ApiReservation[]>([]);
  const [loading,  setLoading]= useState(true);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.all([dashboardApi.stats(), reservationsApi.list()])
      .then(([s, r]) => { setStats(s); setRes(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const kpis = stats ? [
    { emoji: '💰', label: 'Orders · Today', val: String(stats.orders_today),    sub: `${stats.orders_paid} paid`,        delta: '', up: true },
    { emoji: '🪑', label: 'Tables occupied', val: `${stats.tables_occupied}/${stats.tables_total}`, sub: 'live', delta: '', up: true },
    { emoji: '👥', label: 'Staff on floor',  val: String(stats.staff_active),    sub: `${stats.staff_on_break} on break`, delta: '', up: true },
    { emoji: '📦', label: 'Low inventory',   val: String(stats.inventory_low),   sub: 'items below par',  delta: '', up: false },
  ] : [];

  return (
    <div className="mgr-overview">
      <div className="mgr-dateline eyebrow">{today}</div>
      <h1 className="serif mgr-greeting">
        Good {clock < '12:00' ? 'morning' : clock < '17:00' ? 'afternoon' : 'evening'},&nbsp;
        {user?.name?.split(' ')[0] ?? 'Chef'}.
      </h1>
      <p className="mgr-sub">
        {stats
          ? `${stats.tables_occupied} tables occupied · ${stats.staff_active} staff on floor`
          : 'Loading service stats…'}
      </p>

      <div className="mgr-action-row">
        <button className="btn-outline" onClick={() => onNav('reports')}>Export</button>
        <button className="btn-outline" onClick={() => onNav('reports')}>Daily Report</button>
        <button className="btn-gold"    onClick={() => navigate('/pos')}>+ New Order</button>
      </div>

      {/* KPI cards */}
      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 13, margin: '16px 0' }}>Loading stats…</p>
      ) : (
        <div className="mgr-kpis">
          {kpis.map(k => (
            <div key={k.label} className="mgr-kpi card">
              <div className="mgr-kpi-top">
                <span className="mgr-kpi-emoji">{k.emoji}</span>
                {k.delta && <span className={`mgr-kpi-delta ${k.up ? 'up' : 'dn'}`}>{k.delta}</span>}
              </div>
              <p className="mgr-kpi-label">{k.label}</p>
              <p className="serif mgr-kpi-val">{k.val}</p>
              <p className="mgr-kpi-sub">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Reservations */}
      {res.length > 0 && (
        <div className="mgr-res-card card">
          <div className="mgr-res-head">
            <p className="eyebrow">Reservations · tonight</p>
            <span className="serif mgr-res-count">{res.length}</span>
          </div>
          {res.map(r => (
            <div key={r.id} className="mgr-res-row">
              <span className="mono mgr-res-time">{r.res_time}</span>
              <span className="mgr-res-name">{r.guest_name} · {r.covers}</span>
              <span className="mgr-res-table mono">{r.table_name ?? r.table_id ?? '—'}</span>
              {r.note && <span className="mgr-res-note">{r.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inventory ─────────────────────────────────────────────────────────────────
function InventoryTab() {
  const [rows,    setRows]    = useState<ApiInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding,  setAdding]  = useState(false);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [draft,   setDraft]   = useState({ name: '', par: 0, current: 0, unit: 'kg' });
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    inventoryApi.list().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function saveEdit(id: string) {
    setBusy(true);
    try {
      const updated = await inventoryApi.update(id, { current: draft.current });
      setRows(prev => prev.map(r => r.id === id ? updated : r));
      setEditId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function addItem() {
    if (!draft.name || draft.par <= 0) return;
    setBusy(true);
    try {
      const created = await inventoryApi.create(draft);
      setRows(prev => [...prev, created]);
      setAdding(false); setDraft({ name: '', par: 0, current: 0, unit: 'kg' });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mgr-overview">
      <p className="eyebrow">Stock · Par Levels</p>
      <h1 className="serif mgr-greeting">Inventory</h1>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
      <button className="btn-gold" style={{ marginBottom: 16 }} onClick={() => setAdding(a => !a)}>
        {adding ? 'Cancel' : '+ Add Item'}
      </button>

      {adding && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="roles-input" placeholder="Item name" value={draft.name}    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <input className="roles-input" placeholder="Par"       value={draft.par}     onChange={e => setDraft(d => ({ ...d, par: +e.target.value }))}     type="number" style={{ width: 80 }} />
          <input className="roles-input" placeholder="Current"   value={draft.current} onChange={e => setDraft(d => ({ ...d, current: +e.target.value }))} type="number" style={{ width: 80 }} />
          <input className="roles-input" placeholder="Unit"      value={draft.unit}    onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))}      style={{ width: 60 }} />
          <button className="roles-save-btn" onClick={addItem} disabled={busy}>{busy ? '…' : 'Save'}</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Loading inventory…</p>
      ) : (
        <div className="mgr-inv-table card">
          <div className="mgr-inv-head">
            <span>Item</span><span>Par</span><span>Current</span><span>Status</span>
          </div>
          {rows.map(r => {
            const pct = (r.current / r.par) * 100;
            const low = pct < 40;
            return (
              <div key={r.id} className="mgr-inv-row">
                <span className="mgr-inv-name">{r.name}</span>
                <span className="mono mgr-inv-par">{r.par} {r.unit}</span>
                <div className="mgr-inv-current">
                  <div className="mgr-inv-bar-bg">
                    <div className="mgr-inv-bar-fill"
                      style={{ width: `${Math.min(pct, 100)}%`, background: low ? 'var(--danger)' : 'var(--gold)' }} />
                  </div>
                  {editId === r.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="number" style={{ width: 60, background: 'var(--bg3)', color: 'var(--text1)', border: '1px solid var(--gold-line2)', borderRadius: 4, padding: '2px 6px' }}
                        value={draft.current} onChange={e => setDraft(d => ({ ...d, current: +e.target.value }))} />
                      <button className="roles-save-btn sm" onClick={() => saveEdit(r.id)} disabled={busy}>✓</button>
                      <button className="roles-cancel-btn sm" onClick={() => setEditId(null)}>✕</button>
                    </div>
                  ) : (
                    <span className={`mono ${low ? 'mgr-inv-low' : ''}`}
                      style={{ cursor: 'pointer' }} title="Click to edit"
                      onClick={() => { setEditId(r.id); setDraft(d => ({ ...d, current: r.current })); }}>
                      {r.current} {r.unit}
                    </span>
                  )}
                </div>
                <span className={`mgr-inv-status ${low ? 'low' : 'ok'}`}>{low ? '⚠ Low' : '✓ OK'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Staff ─────────────────────────────────────────────────────────────────────
function StaffTab({ onNav }: { onNav: (s: Section) => void }) {
  const [staff,   setStaff]   = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.list().then(setStaff).catch(console.error).finally(() => setLoading(false));
  }, []);

  const active = staff.filter(s => s.status === 'active').length;
  const onBreak= staff.filter(s => s.status === 'break').length;

  return (
    <div className="mgr-overview">
      <p className="eyebrow">Team · on floor</p>
      <h1 className="serif mgr-greeting">Staff</h1>
      <p className="mgr-sub">
        {loading ? 'Loading…' : `${active} on floor · ${onBreak} on break · ${staff.length} total tonight`}
      </p>
      <button className="btn-gold" style={{ marginTop: 16 }} onClick={() => onNav('roles')}>
        Manage Roles & Permissions →
      </button>
      <div className="mgr-staff-grid">
        {staff.map(s => (
          <div key={s.id} className="mgr-staff-card card">
            <div className="mgr-staff-avatar serif">{s.initials}</div>
            <p className="mgr-staff-name">{s.name}</p>
            <p className="mgr-staff-role">{s.role.charAt(0).toUpperCase() + s.role.slice(1)}</p>
            <div className={`mgr-staff-status ${s.status}`}>
              <span className="mgr-status-dot" />
              {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────
function Reports() {
  const [stats, setStats]  = useState<ApiDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.stats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  const rows = stats ? [
    { label: 'Orders Today',     value: String(stats.orders_today),   delta: '',      up: true },
    { label: 'Orders Paid',      value: String(stats.orders_paid),    delta: '',      up: true },
    { label: 'Tables Total',     value: String(stats.tables_total),   delta: '',      up: true },
    { label: 'Tables Occupied',  value: String(stats.tables_occupied),delta: '',      up: true },
    { label: 'Staff Active',     value: String(stats.staff_active),   delta: '',      up: true },
    { label: 'Staff On Break',   value: String(stats.staff_on_break), delta: '',      up: false },
    { label: 'Low Inventory',    value: String(stats.inventory_low),  delta: stats.inventory_low > 0 ? '⚠' : '', up: false },
  ] : [];

  return (
    <div className="mgr-overview">
      <p className="eyebrow">Finance · Daily P&L</p>
      <h1 className="serif mgr-greeting">Reports</h1>
      <p className="mgr-sub">Live service metrics from Turso DB.</p>
      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 16 }}>Loading reports…</p>
      ) : (
        <div className="mgr-report-table card">
          <div className="mgr-report-head">
            <span>Metric</span><span>Live Value</span><span>Note</span>
          </div>
          {rows.map(r => (
            <div key={r.label} className="mgr-report-row">
              <span className="mgr-report-label">{r.label}</span>
              <span className="serif mgr-report-val">{r.value}</span>
              <span className={`mgr-report-delta ${r.up ? 'up' : 'dn'}`}>{r.delta}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Manager Panel shell ───────────────────────────────────────────────────────
export function ManagerPanel({ section: initialSection }: { section?: string }) {
  const sectionMap: Record<string, Section> = {
    inventory: 'inventory', staff: 'staff', reports: 'reports', roles: 'roles',
  };
  const [active, setActive] = useState<Section>(
    (sectionMap[initialSection ?? ''] ?? 'overview') as Section,
  );

  return (
    <div className="mgr-root">
      <div className="mgr-tabs">
        {SECTIONS.map(s => (
          <button key={s.id}
            className={`mgr-tab ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mgr-body">
        {active === 'overview'  && <Overview     onNav={setActive} />}
        {active === 'inventory' && <InventoryTab />}
        {active === 'staff'     && <StaffTab     onNav={setActive} />}
        {active === 'reports'   && <Reports />}
        {active === 'roles'     && <RolesPanel />}
      </div>
    </div>
  );
}
