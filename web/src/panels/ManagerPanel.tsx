import { useState, useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  dashboardApi, inventoryApi, restaurantApi, usersApi, reservationsApi, tablesApi,
  type ApiDashboardStats, type ApiInventoryItem, type ApiRestaurant, type ApiUser,
  type ApiReservation, type ApiRevenueResponse, type ApiTable,
} from '../services/api';
import {
  todayISO, currentMonthISO, weekBounds, formatDateISO,
  REPORT_PERIOD_LABELS, type ReportPeriod,
} from '../utils/reportPeriod';
import { useAuth } from '../context/AuthContext';
import { PLAN_HAS_RESERVATIONS } from '../config/planAccess';
import { RolesPanel } from './RolesPanel';
import {
  getRestaurantLogo, previewLogoFile,
  removeRestaurantLogoEverywhere, saveRestaurantLogoFromFile,
  syncRestaurantLogoCache,
} from '../services/restaurantLogoStorage';
import {
  connectBluetooth, connectUSB, disconnectPrinter, printerStatus, printTest,
  printSalesReport, printMonthlyReport, buildDemoSalesReport, buildDemoMonthlyReport,
  type RestaurantPrintMeta, type SalesReportData,
} from '../services/PrintService';
import './ManagerPanel.css';

type Section = 'overview' | 'profile' | 'inventory' | 'tables' | 'reservations' | 'staff' | 'reports' | 'roles';

const BASE_SECTIONS: { id: Section; label: string; minPlan?: 'premium' }[] = [
  { id: 'overview',     label: 'Overview'       },
  { id: 'profile',      label: 'Restaurant Profile' },
  { id: 'inventory',   label: 'Inventory'       },
  { id: 'tables',      label: 'Tables'          },
  { id: 'reservations',label: 'Reservations',    minPlan: 'premium' },
  { id: 'staff',       label: 'Staff'           },
  { id: 'reports',     label: 'Reports'         },
  { id: 'roles',       label: 'Role Management' },
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
        <button className="btn-outline" onClick={() => onNav('profile')}>Restaurant Profile</button>
        <button className="btn-outline" onClick={() => onNav('reports')}>Export</button>
        <button className="btn-outline" onClick={() => onNav('reports')}>Daily Report</button>
        <button className="btn-outline" onClick={() => navigate('/license')}>License / Upgrade</button>
        <button className="btn-gold"    onClick={() => navigate('/pos')}>+ New Order</button>
      </div>

      {/* KPI cards */}
      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 13, margin: '16px 0' }}>Loading stats…</p>
      ) : (
        <div className="mgr-kpis">
          {kpis.map(k => {
            const isTables = k.label.includes('Tables');
            const content = (
              <>
                <div className="mgr-kpi-top">
                  <span className="mgr-kpi-emoji">{k.emoji}</span>
                  {k.delta && <span className={`mgr-kpi-delta ${k.up ? 'up' : 'dn'}`}>{k.delta}</span>}
                </div>
                <p className="mgr-kpi-label">{k.label}</p>
                <p className="serif mgr-kpi-val">{k.val}</p>
                <p className="mgr-kpi-sub">{k.sub}</p>
                {isTables && <span className="mgr-kpi-link">Manage tables →</span>}
              </>
            );
            return isTables ? (
              <button
                key={k.label}
                type="button"
                className="mgr-kpi card mgr-kpi-clickable"
                onClick={() => navigate('/tables/setup')}
              >
                {content}
              </button>
            ) : (
              <div key={k.label} className="mgr-kpi card">{content}</div>
            );
          })}
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
  const [rows,          setRows]          = useState<ApiInventoryItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [adding,        setAdding]        = useState(false);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [draft,         setDraft]         = useState({ name: '', par: 0, current: 0, unit: 'kg' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    inventoryApi.list().then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  function startEdit(r: ApiInventoryItem) {
    setEditId(r.id);
    setDraft({ name: r.name, par: r.par, current: r.current, unit: r.unit });
    setAdding(false);
  }

  async function saveEdit(id: string) {
    setBusy(true);
    try {
      const updated = await inventoryApi.update(id, {
        name: draft.name, par: draft.par, current: draft.current, unit: draft.unit,
      });
      setRows(prev => prev.map(r => r.id === id ? updated : r));
      setEditId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteItem(id: string) {
    setBusy(true);
    try {
      await inventoryApi.delete(id);
      setRows(prev => prev.filter(r => r.id !== id));
      setConfirmDelete(null);
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
      <button className="btn-gold" style={{ marginBottom: 16 }} onClick={() => { setAdding(a => !a); setEditId(null); }}>
        {adding ? 'Cancel' : '+ Add Item'}
      </button>

      {adding && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="roles-input" placeholder="Item name *" value={draft.name}    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <input className="roles-input" placeholder="Par"       value={draft.par || ''}     onChange={e => setDraft(d => ({ ...d, par: +e.target.value }))}     type="number" style={{ width: 80 }} />
          <input className="roles-input" placeholder="Current"   value={draft.current || ''} onChange={e => setDraft(d => ({ ...d, current: +e.target.value }))} type="number" style={{ width: 80 }} />
          <input className="roles-input" placeholder="Unit"      value={draft.unit}    onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))}      style={{ width: 60 }} />
          <button className="roles-save-btn" onClick={addItem} disabled={!draft.name || busy}>{busy ? '…' : 'Save'}</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Loading inventory…</p>
      ) : (
        <div className="mgr-inv-table card">
          <div className="mgr-inv-head">
            <span>Item</span><span>Par</span><span>Current</span><span>Status</span><span>Actions</span>
          </div>
          {rows.map(r => {
            const pct = r.par > 0 ? (r.current / r.par) * 100 : 0;
            const low = pct < 40;
            return (
              <div key={r.id} className="mgr-inv-row">
                {editId === r.id ? (
                  /* Full inline edit */
                  <>
                    <input className="roles-input-sm" value={draft.name}    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}    placeholder="Name" />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input type="number" className="roles-input-sm" value={draft.par || ''}     onChange={e => setDraft(d => ({ ...d, par: +e.target.value }))}     style={{ width: 60 }} placeholder="Par" />
                      <input className="roles-input-sm" value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} style={{ width: 50 }} placeholder="unit" />
                    </div>
                    <input type="number" className="roles-input-sm" value={draft.current || ''} onChange={e => setDraft(d => ({ ...d, current: +e.target.value }))} style={{ width: 80 }} placeholder="Current" />
                    <span />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="roles-save-btn sm" onClick={() => saveEdit(r.id)} disabled={busy}>✓</button>
                      <button className="roles-cancel-btn sm" onClick={() => setEditId(null)}>✕</button>
                    </div>
                  </>
                ) : (
                  /* Display view */
                  <>
                    <span className="mgr-inv-name">{r.name}</span>
                    <span className="mono mgr-inv-par">{r.par} {r.unit}</span>
                    <div className="mgr-inv-current">
                      <div className="mgr-inv-bar-bg">
                        <div className="mgr-inv-bar-fill"
                          style={{ width: `${Math.min(pct, 100)}%`, background: low ? 'var(--danger)' : 'var(--gold)' }} />
                      </div>
                      <span className={`mono ${low ? 'mgr-inv-low' : ''}`}>{r.current} {r.unit}</span>
                    </div>
                    <span className={`mgr-inv-status ${low ? 'low' : 'ok'}`}>{low ? '⚠ Low' : '✓ OK'}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="roles-edit-btn" onClick={() => startEdit(r)}>Edit</button>
                      {confirmDelete === r.id ? (
                        <>
                          <button className="roles-del-confirm" onClick={() => deleteItem(r.id)} disabled={busy}>{busy ? '…' : 'OK'}</button>
                          <button className="roles-cancel-btn sm" onClick={() => setConfirmDelete(null)}>✕</button>
                        </>
                      ) : (
                        <button className="roles-del-btn" onClick={() => setConfirmDelete(r.id)}>Del</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {rows.length === 0 && (
            <p style={{ color: 'var(--text3)', padding: '16px 0', fontSize: 13, gridColumn: '1/-1' }}>
              No inventory items. Add some above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tables management ─────────────────────────────────────────────────────────
function TablesTab() {
  const [tables,        setTables]        = useState<ApiTable[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [adding,        setAdding]        = useState(false);
  const [draft,         setDraft]         = useState({ name: '', zone: 'Main', capacity: 2 });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    tablesApi.list().then(setTables).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  async function addTable() {
    if (!draft.name) return;
    setBusy(true); setError('');
    try {
      const created = await tablesApi.create(draft);
      setTables(prev => [...prev, created]);
      setAdding(false); setDraft({ name: '', zone: 'Main', capacity: 2 });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteTable(id: string) {
    setBusy(true); setError('');
    try {
      await tablesApi.delete(id);
      setTables(prev => prev.filter(t => t.id !== id));
      setConfirmDelete(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const zones = [...new Set(tables.map(t => t.zone))].sort();

  return (
    <div className="mgr-overview">
      <div className="mgr-table-setup-head">
        <div>
          <p className="eyebrow">Floor · Zones</p>
          <h1 className="serif mgr-greeting">Table Setup</h1>
          <p className="mgr-sub">{tables.length} tables across {zones.length || 0} zones</p>
        </div>
        <button
          type="button"
          className="btn-gold mgr-add-table-btn"
          onClick={() => setAdding(a => !a)}
        >
          {adding ? 'Cancel' : '+ Add Table'}
        </button>
      </div>

      {error && <p className="mgr-inline-error">{error}</p>}

      {adding && (
        <div className="mgr-add-row">
          <input className="roles-input" placeholder="Table name (e.g. T-01)" value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <input className="roles-input mgr-add-sm" placeholder="Zone" value={draft.zone}
            onChange={e => setDraft(d => ({ ...d, zone: e.target.value }))} />
          <input className="roles-input mgr-add-xs" placeholder="Capacity" type="number" min="1"
            value={draft.capacity} onChange={e => setDraft(d => ({ ...d, capacity: +e.target.value }))} />
          <button className="roles-save-btn" onClick={addTable} disabled={!draft.name || busy}>
            {busy ? '…' : 'Save'}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Loading tables…</p>
      ) : (
        <div className="mgr-inv-table card">
          <div className="mgr-inv-head mgr-tables-grid">
            <span>Table</span><span>Zone</span><span>Capacity</span><span>Status</span><span>Actions</span>
          </div>
          {tables.map(t => {
            const statusColor =
              t.status === 'occupied' ? 'var(--gold)' :
              t.status === 'paying'   ? 'var(--warning, #facc15)' :
              t.status === 'reserved' ? '#60a5fa' :
              t.status === 'attention'? 'var(--danger)' : 'var(--text3)';
            return (
              <div key={t.id} className="mgr-inv-row mgr-tables-grid">
                <span className="mgr-inv-name mono">{t.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{t.zone}</span>
                <span className="mono" style={{ fontSize: 12 }}>{t.capacity}</span>
                <span style={{ fontSize: 12, color: statusColor, textTransform: 'capitalize' }}>{t.status}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {confirmDelete === t.id ? (
                    <>
                      <button className="roles-del-confirm" onClick={() => deleteTable(t.id)} disabled={busy}>
                        {busy ? '…' : 'Confirm'}
                      </button>
                      <button className="roles-cancel-btn sm" onClick={() => setConfirmDelete(null)}>✕</button>
                    </>
                  ) : (
                    <button className="roles-del-btn"
                      onClick={() => setConfirmDelete(t.id)}
                      disabled={t.status !== 'empty'}
                      title={t.status !== 'empty' ? 'Can only delete empty tables' : 'Delete table'}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {tables.length === 0 && (
            <p style={{ color: 'var(--text3)', padding: '16px 0', fontSize: 13 }}>No tables yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Reservations ──────────────────────────────────────────────────────────────
type ReservationDraft = {
  guest_name: string;
  covers: number;
  res_time: string;
  note: string;
  table_id: string;
  status: string;
};

/** Module-level fields — must NOT be defined inside ReservationsTab or inputs lose focus. */
function ReservationFormFields({
  draft,
  setDraft,
  tables,
  tableFilter,
}: {
  draft: ReservationDraft;
  setDraft: Dispatch<SetStateAction<ReservationDraft>>;
  tables: ApiTable[];
  /** When true, only empty/reserved tables (new reservation). When false, all tables (edit row). */
  tableFilter?: boolean;
}) {
  const tableOptions = tableFilter
    ? tables.filter(t => t.status === 'empty' || t.status === 'reserved')
    : tables;

  return (
    <div className="form-grid-3" style={{ marginBottom: 12 }}>
      <input className="roles-input" placeholder="Guest name *"
        value={draft.guest_name} onChange={e => setDraft(d => ({ ...d, guest_name: e.target.value }))} />
      <input className="roles-input" placeholder="Covers" type="number" min="1"
        value={draft.covers} onChange={e => setDraft(d => ({ ...d, covers: +e.target.value }))}
        style={{ width: 80 }} />
      <input className="roles-input" placeholder="Time (e.g. 19:30)"
        value={draft.res_time} onChange={e => setDraft(d => ({ ...d, res_time: e.target.value }))} />
      <select className="roles-select" value={draft.table_id}
        onChange={e => setDraft(d => ({ ...d, table_id: e.target.value }))}>
        <option value="">{tableFilter ? '— No table assigned —' : '— No table —'}</option>
        {tableOptions.map(t => (
          <option key={t.id} value={t.id}>{t.name}{tableFilter ? ` · ${t.capacity}-top` : ''}</option>
        ))}
      </select>
      <input className="roles-input" placeholder="Note / dietary"
        value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
        style={{ gridColumn: '2 / -1' }} />
    </div>
  );
}

function ReservationsTab() {
  const [res,           setRes]           = useState<ApiReservation[]>([]);
  const [tables,        setTables]        = useState<ApiTable[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [adding,        setAdding]        = useState(false);
  const [editId,        setEditId]        = useState<string | null>(null);
  const [draft,         setDraft]         = useState<ReservationDraft>({
    guest_name: '', covers: 2, res_time: '', note: '', table_id: '', status: 'confirmed',
  });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    Promise.all([reservationsApi.list(), tablesApi.list()])
      .then(([r, t]) => { setRes(r); setTables(t); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const blankDraft = () => ({
    guest_name: '', covers: 2, res_time: '19:00',
    note: '', table_id: '', status: 'confirmed',
  });

  function startEdit(r: ApiReservation) {
    setEditId(r.id);
    setDraft({
      guest_name: r.guest_name, covers: r.covers,
      res_time: r.res_time,
      note: r.note ?? '', table_id: r.table_id ?? '', status: r.status,
    });
    setAdding(false);
  }

  async function saveEdit() {
    if (!editId || !draft.guest_name || !draft.res_time) return;
    setBusy(true); setError('');
    try {
      const updated = await reservationsApi.update(editId, {
        guest_name: draft.guest_name, covers: draft.covers,
        res_time: draft.res_time, note: draft.note || undefined,
        table_id: draft.table_id || undefined, status: draft.status,
      });
      setRes(prev => prev.map(r => r.id === editId ? updated : r));
      setEditId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function addRes() {
    if (!draft.guest_name || !draft.res_time) return;
    setBusy(true); setError('');
    try {
      const created = await reservationsApi.create({
        guest_name: draft.guest_name, covers: draft.covers,
        res_time: draft.res_time, note: draft.note || undefined,
        table_id: draft.table_id || undefined,
      });
      setRes(prev => [...prev, created].sort((a, b) => a.res_time.localeCompare(b.res_time)));
      setAdding(false); setDraft(blankDraft());
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteRes(id: string) {
    setBusy(true); setError('');
    try {
      await reservationsApi.delete(id);
      setRes(prev => prev.filter(r => r.id !== id));
      setConfirmDelete(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function quickStatus(id: string, status: string) {
    setBusy(true); setError('');
    try {
      const updated = await reservationsApi.update(id, { status });
      setRes(prev => prev.map(r => r.id === id ? updated : r));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const statusColor: Record<string, string> = {
    confirmed: 'var(--gold)',
    seated:    'var(--success, #4ade80)',
    cancelled: 'var(--danger)',
    'no-show': 'var(--text3)',
  };

  return (
    <div className="mgr-overview">
      <p className="eyebrow">Bookings · Tonight</p>
      <h1 className="serif mgr-greeting">Reservations</h1>
      <p className="mgr-sub">{res.filter(r => r.status === 'confirmed').length} confirmed · {res.length} total</p>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '4px 0' }}>{error}</p>}

      <button className="btn-gold" style={{ marginBottom: 16 }}
        onClick={() => { setAdding(a => !a); setEditId(null); setDraft(blankDraft()); }}>
        {adding ? 'Cancel' : '+ New Reservation'}
      </button>

      {adding && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>New reservation</p>
          <ReservationFormFields draft={draft} setDraft={setDraft} tables={tables} tableFilter />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="roles-save-btn" onClick={addRes}
              disabled={!draft.guest_name || !draft.res_time || busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button className="roles-cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>Loading reservations…</p>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {res.length === 0 && (
            <p style={{ color: 'var(--text3)', padding: 16, fontSize: 13 }}>No reservations.</p>
          )}
          {res.map(r => (
            <div key={r.id} style={{
              padding: '12px 16px', borderBottom: '0.5px solid var(--line)',
              background: editId === r.id ? 'var(--hover)' : undefined,
            }}>
              {editId === r.id ? (
                <>
                  <div className="form-grid-3" style={{ marginBottom: 8 }}>
                    <input className="roles-input" value={draft.guest_name}
                      onChange={e => setDraft(d => ({ ...d, guest_name: e.target.value }))} />
                    <input className="roles-input" type="number" value={draft.covers}
                      onChange={e => setDraft(d => ({ ...d, covers: +e.target.value }))} style={{ width: 80 }} />
                    <input className="roles-input" type="datetime-local" value={draft.res_time}
                      onChange={e => setDraft(d => ({ ...d, res_time: e.target.value }))} />
                    <select className="roles-select" value={draft.table_id}
                      onChange={e => setDraft(d => ({ ...d, table_id: e.target.value }))}>
                      <option value="">— No table —</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <select className="roles-select" value={draft.status}
                      onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                      <option value="confirmed">Confirmed</option>
                      <option value="seated">Seated</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no-show">No-show</option>
                    </select>
                    <input className="roles-input" placeholder="Note"
                      value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="roles-save-btn sm" onClick={saveEdit} disabled={busy}>✓ Save</button>
                    <button className="roles-cancel-btn sm" onClick={() => setEditId(null)}>✕</button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{r.guest_name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text2)', margin: '2px 0' }}>
                      {r.covers} covers · {r.res_time}
                      {r.table_name ? ` · ${r.table_name}` : ''}
                    </p>
                    {r.note && <p style={{ fontSize: 11, color: 'var(--text3)', margin: 0 }}>📝 {r.note}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: statusColor[r.status] ?? 'var(--text3)',
                      fontWeight: 600, textTransform: 'capitalize', padding: '2px 8px',
                      border: `0.5px solid ${statusColor[r.status] ?? 'var(--line)'}`,
                      borderRadius: 100 }}>{r.status}</span>
                    {r.status === 'confirmed' && (
                      <button className="roles-edit-btn"
                        onClick={() => quickStatus(r.id, 'seated')} disabled={busy}>
                        Seat
                      </button>
                    )}
                    <button className="roles-edit-btn" onClick={() => startEdit(r)}>Edit</button>
                    {confirmDelete === r.id ? (
                      <>
                        <button className="roles-del-confirm" onClick={() => deleteRes(r.id)} disabled={busy}>
                          {busy ? '…' : 'Confirm'}
                        </button>
                        <button className="roles-cancel-btn sm" onClick={() => setConfirmDelete(null)}>✕</button>
                      </>
                    ) : (
                      <button className="roles-del-btn" onClick={() => setConfirmDelete(r.id)}>Delete</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
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
function restaurantPrintMeta(r: ApiRestaurant): RestaurantPrintMeta {
  return {
    restaurantName: r.name ?? 'Restaurant',
    logoUrl: getRestaurantLogo(r.id, r.logo_url),
    addressLine: [r.address_line1, r.city, r.country].filter(Boolean).join(', ') || undefined,
    phone: r.contact_phone || undefined,
    taxId: r.tax_id || undefined,
    email: r.contact_email || undefined,
  };
}

const REPORT_PERIODS: ReportPeriod[] = ['day', 'week', 'month', 'range'];

function Reports() {
  const [period,         setPeriod]         = useState<ReportPeriod>('week');
  const [selectedDate,   setSelectedDate]     = useState(todayISO);
  const [selectedMonth,  setSelectedMonth]    = useState(currentMonthISO);
  const [rangeFrom,      setRangeFrom]        = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return formatDateISO(d);
  });
  const [rangeTo,        setRangeTo]          = useState(todayISO);
  const [stats,          setStats]            = useState<ApiDashboardStats | null>(null);
  const [report,         setReport]           = useState<ApiRevenueResponse | null>(null);
  const [restaurant,     setRestaurant]       = useState<ApiRestaurant | null>(null);
  const [loading,        setLoading]          = useState(true);
  const [revenueLoading, setRevenueLoading]  = useState(false);
  const [printBusy,      setPrintBusy]        = useState(false);
  const [printMsg,       setPrintMsg]         = useState('');
  const [printErr,       setPrintErr]         = useState('');
  const [printer,        setPrinter]          = useState<{ type: 'none' | 'bluetooth' | 'usb'; name: string }>({ type: 'none', name: '' });

  useEffect(() => {
    setPrinter(printerStatus());
    Promise.all([dashboardApi.stats(), restaurantApi.me()])
      .then(([s, rest]) => {
        setStats(s);
        setRestaurant(rest);
        syncRestaurantLogoCache(rest);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRevenueLoading(true);
    const query =
      period === 'day'   ? { period: 'day' as const, date: selectedDate }
      : period === 'week'  ? { period: 'week' as const, date: selectedDate }
      : period === 'month' ? { period: 'month' as const, month: selectedMonth }
      : { period: 'range' as const, from: rangeFrom, to: rangeTo };

    dashboardApi.revenue(query)
      .then(r => { if (!cancelled) setReport(r); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setRevenueLoading(false); });
    return () => { cancelled = true; };
  }, [period, selectedDate, selectedMonth, rangeFrom, rangeTo]);

  const meta = restaurant ? restaurantPrintMeta(restaurant) : { restaurantName: 'Cafyz Demo Restaurant' };
  const rid = restaurant?.id;

  async function runPrint(
    fn: () => Promise<'bluetooth' | 'usb' | 'dialog'>,
    label: string,
  ) {
    setPrintBusy(true); setPrintErr(''); setPrintMsg('');
    try {
      const channel = await fn();
      setPrintMsg(
        channel === 'dialog'
          ? `${label} opened in print preview — connect Bluetooth/USB to print on thermal paper.`
          : `${label} sent to ${channel === 'bluetooth' ? 'Bluetooth' : 'USB'} printer.`,
      );
    } catch (e) { setPrintErr((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  async function connectReportBT() {
    setPrintBusy(true); setPrintErr('');
    try {
      const name = await connectBluetooth();
      setPrinter({ type: 'bluetooth', name });
      setPrintMsg(`Connected to ${name}`);
    } catch (e) { setPrintErr((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  async function connectReportUSB() {
    setPrintBusy(true); setPrintErr('');
    try {
      const name = await connectUSB();
      setPrinter({ type: 'usb', name });
      setPrintMsg(`Connected to ${name}`);
    } catch (e) { setPrintErr((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  function disconnectReportPrinter() {
    disconnectPrinter();
    setPrinter({ type: 'none', name: '' });
    setPrintMsg('');
  }

  function liveSalesReport(): SalesReportData {
    const rows = report?.rows ?? [];
    const hasLive = rows.length > 0;
    const title =
      period === 'day'   ? 'Daily Sales Report'
      : period === 'week'  ? 'Weekly Sales Report'
      : period === 'range' ? 'Sales Report'
      : 'Sales Report';
    return {
      ...meta,
      title,
      periodLabel: report?.periodLabel ?? 'Selected period',
      demo: !hasLive,
      metrics: stats ? [
        { label: 'Orders today', value: String(stats.orders_today) },
        { label: 'Paid today', value: String(stats.orders_paid) },
        { label: 'Tables occupied', value: `${stats.tables_occupied}/${stats.tables_total}` },
      ] : [],
      rows: hasLive
        ? [...rows].reverse().map(r => ({
            label: r.day,
            orders: r.order_count,
            revenue: r.revenue ?? 0,
          }))
        : buildDemoSalesReport(meta).rows,
      totalRevenue: hasLive ? (report?.totalRevenue ?? 0) : buildDemoSalesReport(meta).totalRevenue,
      totalOrders: hasLive ? (report?.totalOrders ?? 0) : buildDemoSalesReport(meta).totalOrders,
    };
  }

  function liveMonthlyReport() {
    const rows = report?.rows ?? [];
    const hasLive = rows.length > 0;
    if (!hasLive) return buildDemoMonthlyReport(meta);
    const days = rows.map(r => ({
      day: r.day,
      orders: r.order_count ?? 0,
      revenue: r.revenue ?? 0,
    }));
    const totalRevenue = report?.totalRevenue ?? 0;
    const totalOrders = report?.totalOrders ?? 0;
    return {
      ...meta,
      monthLabel: report?.periodLabel ?? selectedMonth,
      demo: false,
      days,
      totalRevenue,
      totalOrders,
      avgPerDay: days.length ? totalRevenue / days.length : 0,
    };
  }

  function printCurrentReport() {
    if (period === 'month') {
      return runPrint(() => printMonthlyReport(liveMonthlyReport(), rid), 'Monthly report');
    }
    return runPrint(() => printSalesReport(liveSalesReport(), rid), 'Sales report');
  }

  const statsRows = stats ? [
    { label: 'Orders Today',    value: String(stats.orders_today),    delta: '',      up: true  },
    { label: 'Orders Paid',     value: String(stats.orders_paid),     delta: '',      up: true  },
    { label: 'Tables Total',    value: String(stats.tables_total),    delta: '',      up: true  },
    { label: 'Tables Occupied', value: String(stats.tables_occupied), delta: '',      up: true  },
    { label: 'Staff Active',    value: String(stats.staff_active),    delta: '',      up: true  },
    { label: 'Staff On Break',  value: String(stats.staff_on_break),  delta: '',      up: false },
    { label: 'Low Inventory',   value: String(stats.inventory_low),
      delta: stats.inventory_low > 0 ? '⚠' : '', up: false },
  ] : [];

  const revenueRows = report?.rows ?? [];
  const totalRevenue = report?.totalRevenue ?? 0;
  const weekSpan = period === 'week' ? weekBounds(selectedDate) : null;

  return (
    <div className="mgr-overview">
      <p className="eyebrow">Finance · Daily P&L</p>
      <h1 className="serif mgr-greeting">Reports</h1>
      <p className="mgr-sub">Daily, weekly, and monthly revenue · print on Bluetooth, USB, or browser.</p>

      {!loading && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <p className="eyebrow" style={{ marginTop: 0 }}>Report period</p>
          <div className="mgr-range-btns" style={{ marginBottom: 12 }}>
            {REPORT_PERIODS.map(p => (
              <button
                key={p}
                type="button"
                className={`mgr-range${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {REPORT_PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {period === 'day' && (
              <label style={{ fontSize: 13 }}>
                Date{' '}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="mgr-input"
                  style={{ marginLeft: 6 }}
                />
              </label>
            )}
            {period === 'week' && (
              <label style={{ fontSize: 13 }}>
                Week containing{' '}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="mgr-input"
                  style={{ marginLeft: 6 }}
                />
              </label>
            )}
            {period === 'month' && (
              <label style={{ fontSize: 13 }}>
                Month{' '}
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="mgr-input"
                  style={{ marginLeft: 6 }}
                />
              </label>
            )}
            {period === 'range' && (
              <>
                <label style={{ fontSize: 13 }}>
                  From{' '}
                  <input
                    type="date"
                    value={rangeFrom}
                    max={rangeTo}
                    onChange={e => setRangeFrom(e.target.value)}
                    className="mgr-input"
                    style={{ marginLeft: 6 }}
                  />
                </label>
                <label style={{ fontSize: 13 }}>
                  To{' '}
                  <input
                    type="date"
                    value={rangeTo}
                    min={rangeFrom}
                    onChange={e => setRangeTo(e.target.value)}
                    className="mgr-input"
                    style={{ marginLeft: 6 }}
                  />
                </label>
              </>
            )}
            {weekSpan && (
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                {weekSpan.from} → {weekSpan.to}
              </span>
            )}
            {report?.periodLabel && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>{report.periodLabel}</span>
            )}
            {revenueLoading && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Updating…</span>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <p className="eyebrow" style={{ marginTop: 0 }}>Report printer</p>
          <p className="mgr-sub" style={{ marginTop: 0, marginBottom: 10 }}>
            Connect a thermal printer once — report buttons below will use it automatically.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {printer.type !== 'none' ? (
              <>
                <span style={{ fontSize: 13 }}>
                  {printer.type === 'bluetooth' ? '🔵' : '🔌'} {printer.name}
                </span>
                <button type="button" className="btn-outline" onClick={disconnectReportPrinter} disabled={printBusy}>
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-outline" onClick={connectReportBT} disabled={printBusy}>
                  🔵 Bluetooth
                </button>
                <button type="button" className="btn-outline" onClick={connectReportUSB} disabled={printBusy}>
                  🔌 USB
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {!loading && (
        <div className="mgr-action-row" style={{ marginBottom: 16 }}>
          <button className="btn-gold" disabled={printBusy || revenueLoading}
            onClick={() => printCurrentReport()}>
            🖨 Print {REPORT_PERIOD_LABELS[period]} Report
          </button>
          <button className="btn-outline" disabled={printBusy}
            onClick={() => runPrint(() => printSalesReport(buildDemoSalesReport(meta), rid), 'Demo sales report')}>
            🖨 Demo layout
          </button>
        </div>
      )}
      {printMsg && <p style={{ color: 'var(--ok, #2ECC8A)', fontSize: 12 }}>{printMsg}</p>}
      {printErr && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{printErr}</p>}
      {restaurant && getRestaurantLogo(restaurant.id, restaurant.logo_url) && (
        <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
          Reports use your restaurant logo (shared with all staff){restaurant.name ? ` · ${restaurant.name}` : ''}.
        </p>
      )}

      {loading ? (
        <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 16 }}>Loading reports…</p>
      ) : (
        <>
          {/* Revenue summary */}
          {!revenueLoading && revenueRows.length > 0 && (
            <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>
                  Revenue · {report?.periodLabel ?? REPORT_PERIOD_LABELS[period]}
                </p>
                <p className="serif" style={{ fontSize: 28, color: 'var(--gold)' }}>
                  ${totalRevenue.toFixed(2)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {report?.totalOrders ?? 0} orders · {revenueRows.length} days
                </p>
                <p style={{ fontSize: 13, color: 'var(--text1)', marginTop: 4 }}>
                  avg ${revenueRows.length ? (totalRevenue / revenueRows.length).toFixed(0) : 0}/day
                </p>
              </div>
            </div>
          )}
          {!revenueLoading && revenueRows.length === 0 && (
            <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
              <p className="eyebrow" style={{ marginBottom: 4 }}>No paid orders</p>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
                No revenue recorded for {report?.periodLabel ?? 'this period'}. Print still uses demo data until orders are paid.
              </p>
            </div>
          )}

          {/* Service metrics */}
          <div className="mgr-report-table card">
            <div className="mgr-report-head">
              <span>Metric</span><span>Live Value</span><span>Flag</span>
            </div>
            {statsRows.map(r => (
              <div key={r.label} className="mgr-report-row">
                <span className="mgr-report-label">{r.label}</span>
                <span className="serif mgr-report-val">{r.value}</span>
                <span className={`mgr-report-delta ${r.up ? 'up' : 'dn'}`}>{r.delta}</span>
              </div>
            ))}
          </div>

          {/* Daily revenue breakdown */}
          {revenueRows.length > 0 && (
            <div className="mgr-report-table card" style={{ marginTop: 20 }}>
              <div className="mgr-report-head">
                <span>Date</span><span>Orders</span><span>Revenue</span>
              </div>
              {[...revenueRows].reverse().map(r => (
                <div key={r.day} className="mgr-report-row">
                  <span className="mgr-report-label mono" style={{ fontSize: 12 }}>{r.day}</span>
                  <span className="mgr-report-val">{r.order_count}</span>
                  <span className="serif mgr-report-val" style={{ color: 'var(--gold)' }}>
                    ${(r.revenue ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({
    name: '', timezone: '', contact_phone: '', contact_email: '',
    address_line1: '', address_line2: '', city: '', country: '', postal_code: '', tax_id: '', website_url: '',
  });

  // Logo (device localStorage only)
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // Printer state
  const [printer, setPrinter] = useState<{ type: 'none' | 'bluetooth' | 'usb'; name: string }>({ type: 'none', name: '' });
  const [printBusy, setPrintBusy] = useState(false);
  const [printMsg, setPrintMsg] = useState('');
  const [printErr, setPrintErr] = useState('');

  useEffect(() => {
    setPrinter(printerStatus());
    restaurantApi.me()
      .then(r => {
        setRestaurant(r);
        syncRestaurantLogoCache(r);
        setLogoPreview(getRestaurantLogo(r.id, r.logo_url));
        setDraft({
          name: r.name ?? '', timezone: r.timezone ?? '',
          contact_phone: r.contact_phone ?? '', contact_email: r.contact_email ?? '',
          address_line1: r.address_line1 ?? '', address_line2: r.address_line2 ?? '',
          city: r.city ?? '', country: r.country ?? '', postal_code: r.postal_code ?? '', tax_id: r.tax_id ?? '',
          website_url: r.website_url ?? '',
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true); setError('');
    try {
      const updated = await restaurantApi.update(draft);
      setRestaurant(updated);
      const stored = localStorage.getItem('cafyz_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          u.restaurant_name = updated.name;
          localStorage.setItem('cafyz_user', JSON.stringify(u));
        } catch {}
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function onPickLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const restaurantId = restaurant?.id ?? user?.restaurant_id;
    if (!file) return;
    if (!restaurantId) {
      setError('Restaurant profile is still loading — wait a second and try again.');
      return;
    }

    setUploading(true);
    setUploadMsg('');
    setError('');

    const tempPreview = previewLogoFile(file);
    setLogoPreview(tempPreview);

    try {
      const dataUrl = await saveRestaurantLogoFromFile(restaurantId, file);
      setLogoPreview(dataUrl);
      setRestaurant(prev => prev ? { ...prev, logo_url: dataUrl } : prev);
      setUploadMsg('✓ Logo saved — shared with all staff on this restaurant');
    } catch (err) {
      setLogoPreview(getRestaurantLogo(restaurantId, restaurant?.logo_url));
      setError((err as Error).message);
    } finally {
      URL.revokeObjectURL(tempPreview);
      setUploading(false);
    }
  }

  async function onRemoveLogo() {
    const restaurantId = restaurant?.id ?? user?.restaurant_id;
    if (!restaurantId) return;
    setUploading(true);
    setError('');
    try {
      await removeRestaurantLogoEverywhere(restaurantId);
      setRestaurant(r => r ? { ...r, logo_url: null } : r);
      setLogoPreview(undefined);
      setUploadMsg('Logo removed for all staff');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function connectBT() {
    setPrintBusy(true); setPrintErr(''); setPrintMsg('');
    try {
      const name = await connectBluetooth();
      setPrinter({ type: 'bluetooth', name });
      setPrintMsg(`Connected to ${name}`);
    } catch (e) { setPrintErr((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  async function connectUsbPrinter() {
    setPrintBusy(true); setPrintErr(''); setPrintMsg('');
    try {
      const name = await connectUSB();
      setPrinter({ type: 'usb', name });
      setPrintMsg(`Connected to ${name}`);
    } catch (e) { setPrintErr((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  function disconnect() {
    disconnectPrinter();
    setPrinter({ type: 'none', name: '' });
    setPrintMsg(''); setPrintErr('');
  }

  async function runTestPrint() {
    setPrintBusy(true); setPrintErr(''); setPrintMsg('');
    const rid = user?.restaurant_id ?? restaurant?.id;
    if (!getRestaurantLogo(rid, restaurant?.logo_url) && !logoPreview) {
      setPrintErr('Upload a logo first (Upload Logo above), then print the demo receipt.');
      setPrintBusy(false);
      return;
    }
    try {
      const addr = [draft.address_line1, draft.city, draft.country].filter(Boolean).join(', ');
      const channel = await printTest({
        restaurantName: draft.name || restaurant?.name || 'Cafyz',
        restaurantId: user?.restaurant_id ?? restaurant?.id,
        logoUrl: logoPreview,
        addressLine: addr || undefined,
        phone: draft.contact_phone || undefined,
      });
      setPrintMsg(
        channel === 'dialog'
          ? 'No hardware printer connected — opened browser print preview.'
          : `✓ Test receipt sent via ${channel}. Check your printer.`,
      );
    } catch (e) { setPrintErr((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  if (loading) return <p style={{ color: 'var(--text2)', fontSize: 13 }}>Loading profile…</p>;
  return (
    <div className="mgr-overview">
      <p className="eyebrow">Brand · Identity · Billing</p>
      <h1 className="serif mgr-greeting">Restaurant Profile</h1>
      <p className="mgr-sub">Shared by all staff assigned to this restaurant in Role Management.</p>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="card mgr-profile-card">
        <p className="eyebrow" style={{ marginTop: 0 }}>Logo</p>
        <p className="mgr-sub" style={{ marginTop: 0 }}>
          Preview shows the B&W receipt version. Saved to your restaurant (all staff devices). PNG/JPG up to 2 MB.
        </p>
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 12, margin: '8px 0 0' }}>{error}</p>
        )}
        {uploadMsg && !error && (
          <p style={{ color: 'var(--ok, #2ECC8A)', fontSize: 12, margin: '8px 0 0' }}>{uploadMsg}</p>
        )}
        <div className="mgr-logo-row">
          <div className="mgr-logo-preview">
            {logoPreview
              ? <img src={logoPreview} alt="Restaurant logo" />
              : <span style={{ color: 'var(--text2)', fontSize: 11 }}>No logo</span>}
          </div>
          <div className="mgr-logo-actions">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif" hidden onChange={onPickLogo} />
            <button
              className="btn-gold"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Saving…' : logoPreview ? 'Replace Logo' : 'Upload Logo'}
            </button>
            {logoPreview && (
              <button type="button" className="btn-outline" onClick={onRemoveLogo} disabled={uploading}>
                Remove Logo
              </button>
            )}
            {uploadMsg && <span style={{ color: 'var(--ok, #2ECC8A)', fontSize: 12 }}>{uploadMsg}</span>}
          </div>
        </div>
      </div>

      {/* ── Details ───────────────────────────────────────────────────────── */}
      <div className="card mgr-profile-card">
        <div className="form-grid-2">
          <input className="roles-input" placeholder="Restaurant name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <input className="roles-input" placeholder="Timezone" value={draft.timezone} onChange={e => setDraft(d => ({ ...d, timezone: e.target.value }))} />
          <input className="roles-input" placeholder="Website URL" value={draft.website_url} onChange={e => setDraft(d => ({ ...d, website_url: e.target.value }))} />
          <input className="roles-input" placeholder="Phone" value={draft.contact_phone} onChange={e => setDraft(d => ({ ...d, contact_phone: e.target.value }))} />
          <input className="roles-input" placeholder="Email" value={draft.contact_email} onChange={e => setDraft(d => ({ ...d, contact_email: e.target.value }))} />
          <input className="roles-input" placeholder="Address line 1" value={draft.address_line1} onChange={e => setDraft(d => ({ ...d, address_line1: e.target.value }))} />
          <input className="roles-input" placeholder="Address line 2" value={draft.address_line2} onChange={e => setDraft(d => ({ ...d, address_line2: e.target.value }))} />
          <input className="roles-input" placeholder="City" value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} />
          <input className="roles-input" placeholder="Country" value={draft.country} onChange={e => setDraft(d => ({ ...d, country: e.target.value }))} />
          <input className="roles-input" placeholder="Postal code" value={draft.postal_code} onChange={e => setDraft(d => ({ ...d, postal_code: e.target.value }))} />
          <input className="roles-input" placeholder="Tax ID" value={draft.tax_id} onChange={e => setDraft(d => ({ ...d, tax_id: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn-gold" onClick={save} disabled={busy || !draft.name.trim()}>
            {busy ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* ── Printer ───────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <p className="eyebrow" style={{ marginTop: 0 }}>Receipt Printer · Demo Receipt</p>
        <p className="mgr-sub" style={{ marginTop: 0 }}>Connect a Bluetooth/USB thermal printer or use browser print. Demo receipt uses your logo exactly as uploaded.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {printer.type !== 'none' ? (
            <>
              <span style={{ fontSize: 13, color: 'var(--ok, #2ECC8A)' }}>
                {printer.type === 'bluetooth' ? '🔵' : '🔌'} {printer.name}
              </span>
              <button className="roles-btn" onClick={disconnect} disabled={printBusy}>Disconnect</button>
            </>
          ) : (
            <>
              <button className="roles-btn" onClick={connectBT} disabled={printBusy}>
                {printBusy ? '…' : '🔵 Connect Bluetooth'}
              </button>
              <button className="roles-btn" onClick={connectUsbPrinter} disabled={printBusy}>
                🔌 Connect USB
              </button>
            </>
          )}
          <button className="btn-gold" onClick={runTestPrint} disabled={printBusy}>
            {printBusy ? 'Printing…' : '🖨 Print Demo Receipt'}
          </button>
        </div>
        {printMsg && <p style={{ color: 'var(--ok, #2ECC8A)', fontSize: 12, marginBottom: 0 }}>{printMsg}</p>}
        {printErr && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 0 }}>{printErr}</p>}
      </div>
    </div>
  );
}

// ── Manager Panel shell ───────────────────────────────────────────────────────
export function ManagerPanel({ section: initialSection }: { section?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const plan = user?.plan ?? 'basic';
  const hasReservations = PLAN_HAS_RESERVATIONS[plan] ?? false;
  const SECTIONS = BASE_SECTIONS.filter(s => !s.minPlan || hasReservations);

  const sectionMap: Record<string, Section> = {
    profile:      'profile',
    inventory:    'inventory',
    tables:       'tables',
    reservations: 'reservations',
    staff:        'staff',
    reports:      'reports',
    roles:        'roles',
  };
  const [active, setActive] = useState<Section>(
    (sectionMap[initialSection ?? ''] ?? 'overview') as Section,
  );

  function goTab(id: Section) {
    setActive(id);
    if (id === 'tables') navigate('/tables/setup');
    else if (id === 'overview') navigate('/');
    else if (id === 'profile') navigate('/profile');
    else if (id === 'inventory') navigate('/inventory');
    else if (id === 'staff') navigate('/staff');
    else if (id === 'reports') navigate('/reports');
    else if (id === 'roles') navigate('/roles');
  }

  return (
    <div className="mgr-root">
      <div className="mgr-tabs">
        {SECTIONS.map(s => (
          <button key={s.id}
            className={`mgr-tab ${active === s.id ? 'active' : ''}`}
            onClick={() => goTab(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mgr-body">
        {active === 'overview'     && <Overview      onNav={setActive} />}
        {active === 'profile'      && <ProfileTab />}
        {active === 'inventory'    && <InventoryTab />}
        {active === 'tables'       && <TablesTab />}
        {active === 'reservations' && <ReservationsTab />}
        {active === 'staff'        && <StaffTab      onNav={setActive} />}
        {active === 'reports'      && <Reports />}
        {active === 'roles'        && <RolesPanel />}
      </div>
    </div>
  );
}
