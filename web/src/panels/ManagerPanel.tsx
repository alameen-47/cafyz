import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RolesPanel } from './RolesPanel';
import './ManagerPanel.css';

type Section = 'overview' | 'inventory' | 'staff' | 'reports' | 'roles';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview',   label: 'Overview' },
  { id: 'inventory',  label: 'Inventory' },
  { id: 'staff',      label: 'Staff' },
  { id: 'reports',    label: 'Reports' },
  { id: 'roles',      label: 'Role Management' },
];

const REV = [18,22,24,28,32,38,44,43,48,54,58,64,70,76,72,80,84,88,92,96,94,92,96,100,102,106,102,98];
const MAX_REV = Math.max(...REV);

const RESERVATIONS = [
  { time: '19:00', name: 'Dubois · 4', table: 'T·05', note: 'Anniversary' },
  { time: '19:30', name: 'Chen · 2',   table: 'T·11', note: '' },
  { time: '20:00', name: 'Park · 6',   table: 'PDR',  note: "Chef's menu" },
  { time: '20:30', name: 'Vasseur · 3',table: 'T·08', note: '' },
  { time: '21:00', name: 'Lévy · 2',   table: 'T·02', note: 'Allergy: nuts' },
];

const INVENTORY_ROWS = [
  { item: 'Wagyu A5 (kg)',     par: 4,    current: 2.4, unit: 'kg',  alert: true },
  { item: 'Burrata (pcs)',     par: 20,   current: 14,  unit: 'pcs', alert: false },
  { item: 'Black Cod (kg)',    par: 6,    current: 5.8, unit: 'kg',  alert: false },
  { item: 'Lobster (pcs)',     par: 12,   current: 3,   unit: 'pcs', alert: true },
  { item: 'Tuna Crudo (kg)',   par: 3,    current: 2.1, unit: 'kg',  alert: false },
  { item: 'Risotto (kg)',      par: 5,    current: 4.2, unit: 'kg',  alert: false },
  { item: 'Beef Tartare (kg)', par: 4,    current: 1.2, unit: 'kg',  alert: true },
  { item: 'Champagne (btl)',   par: 24,   current: 18,  unit: 'btl', alert: false },
  { item: 'Burgundy (btl)',    par: 36,   current: 22,  unit: 'btl', alert: false },
  { item: 'Olive Oil (L)',     par: 8,    current: 6.5, unit: 'L',   alert: false },
];

const REPORT_ROWS = [
  { label: 'Gross Revenue',   value: '$18,624', delta: '+12.4%', up: true },
  { label: 'Food Revenue',    value: '$11,842', delta: '+9.1%',  up: true },
  { label: 'Beverage Revenue',value: '$6,782',  delta: '+18.7%', up: true },
  { label: 'Covers',          value: '84',      delta: '+6.1%',  up: true },
  { label: 'Avg. Ticket',     value: '$221.71', delta: '+5.8%',  up: true },
  { label: 'Table Turn Time', value: '58m',     delta: '-3.2%',  up: false },
  { label: 'Labour Cost %',   value: '28.4%',   delta: '+1.1%',  up: false },
  { label: 'Food Cost %',     value: '31.2%',   delta: '-0.8%',  up: true },
];

function Overview({ onNav }: { onNav: (s: Section) => void }) {
  const [clock, setClock] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="mgr-overview">
      <div className="mgr-dateline eyebrow">{today}</div>
      <h1 className="serif mgr-greeting">Good evening, Mireille.</h1>
      <p className="mgr-sub">Service is at <strong>84% capacity</strong>. Three reservations expected after 21:00.</p>

      <div className="mgr-action-row">
        <button className="btn-outline" onClick={() => onNav('reports')}>Export</button>
        <button className="btn-outline" onClick={() => onNav('reports')}>Daily Report</button>
        <button className="btn-gold" onClick={() => navigate('/pos')}>+ New Order</button>
      </div>

      {/* KPI cards */}
      <div className="mgr-kpis">
        {[
          { emoji: '💰', label: 'Revenue · Today', val: '$18,624', sub: 'vs. yesterday', delta: '↑ 12.4%', up: true },
          { emoji: '🧾', label: 'Orders',           val: '142',     sub: '84 covers',    delta: '↑ 6.1%',  up: true },
          { emoji: '⏱',  label: 'Avg. Table Time',  val: '58m',     sub: '↓ 4m vs. last week', delta: '↓ 3.2%', up: false },
          { emoji: '👥', label: 'Staff On',          val: '14',      sub: '2 on break',   delta: '',        up: true },
        ].map(k => (
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

      {/* Revenue chart */}
      <div className="mgr-chart-card card">
        <div className="mgr-chart-head">
          <div>
            <p className="eyebrow">Revenue cadence</p>
            <p className="serif mgr-chart-title">Today's service · hourly</p>
          </div>
          <div className="mgr-range-btns">
            {['1D','1W','1M','YTD'].map((r,i) => (
              <button key={r} className={`mgr-range ${i===0?'active':''}`}>{r}</button>
            ))}
          </div>
        </div>
        <div className="mgr-bars">
          {REV.map((v, i) => (
            <div key={i} className={`mgr-bar${i===18?' peak':''}`} style={{ height: `${(v/MAX_REV)*100}%` }} />
          ))}
        </div>
        <div className="mgr-bar-labels">
          {['11A','1P','3P','5P','7P','9P','11P'].map(l => <span key={l}>{l}</span>)}
        </div>
      </div>

      {/* Reservations */}
      <div className="mgr-res-card card">
        <div className="mgr-res-head">
          <p className="eyebrow">Reservations · tonight</p>
          <span className="serif mgr-res-count">{RESERVATIONS.length}</span>
        </div>
        {RESERVATIONS.map(r => (
          <div key={r.time} className="mgr-res-row">
            <span className="mono mgr-res-time">{r.time}</span>
            <span className="mgr-res-name">{r.name}</span>
            <span className="mgr-res-table mono">{r.table}</span>
            {r.note && <span className="mgr-res-note">{r.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Inventory() {
  return (
    <div className="mgr-overview">
      <p className="eyebrow">Stock · Par Levels</p>
      <h1 className="serif mgr-greeting">Inventory</h1>
      <p className="mgr-sub">Par levels, waste tracking, and vendor deliveries.</p>
      <div className="mgr-inv-table card">
        <div className="mgr-inv-head">
          <span>Item</span><span>Par</span><span>Current</span><span>Status</span>
        </div>
        {INVENTORY_ROWS.map(r => {
          const pct = (r.current / r.par) * 100;
          const low = pct < 40;
          return (
            <div key={r.item} className="mgr-inv-row">
              <span className="mgr-inv-name">{r.item}</span>
              <span className="mono mgr-inv-par">{r.par} {r.unit}</span>
              <div className="mgr-inv-current">
                <div className="mgr-inv-bar-bg">
                  <div className="mgr-inv-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: low ? 'var(--danger)' : 'var(--gold)' }} />
                </div>
                <span className={`mono ${low ? 'mgr-inv-low' : ''}`}>{r.current} {r.unit}</span>
              </div>
              <span className={`mgr-inv-status ${low ? 'low' : 'ok'}`}>{low ? '⚠ Low' : '✓ OK'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StaffTab({ onNav }: { onNav: (s: Section) => void }) {
  return (
    <div className="mgr-overview">
      <p className="eyebrow">Team · on floor</p>
      <h1 className="serif mgr-greeting">Staff</h1>
      <p className="mgr-sub">14 on floor · 2 on break · 8 total tonight</p>
      <button className="btn-gold" style={{ marginTop: 16 }} onClick={() => onNav('roles')}>
        Manage Roles & Permissions →
      </button>
      <div className="mgr-staff-grid">
        {[
          { init:'MV', name:'Mireille Vasseur', role:'Manager',    status:'active', time:'17:30' },
          { init:'TD', name:'Thomas Durand',    role:'Cashier',    status:'active', time:'18:00' },
          { init:'JR', name:'Jules Renard',     role:'Waiter',     status:'active', time:'18:00' },
          { init:'IM', name:'Inès Moreau',      role:'Kitchen',    status:'active', time:'16:00' },
          { init:'LF', name:'Léo Fontaine',     role:'Waiter',     status:'break',  time:'18:00' },
          { init:'AB', name:'Amélie Blanc',     role:'Waiter',     status:'active', time:'19:00' },
          { init:'ML', name:'Marc Lecomte',     role:'Kitchen',    status:'active', time:'15:30' },
          { init:'SG', name:'Sophie Girard',    role:'Cashier',    status:'off',    time:'—' },
        ].map(s => (
          <div key={s.init} className="mgr-staff-card card">
            <div className="mgr-staff-avatar serif">{s.init}</div>
            <p className="mgr-staff-name">{s.name}</p>
            <p className="mgr-staff-role">{s.role}</p>
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

function Reports() {
  return (
    <div className="mgr-overview">
      <p className="eyebrow">Finance · Daily P&L</p>
      <h1 className="serif mgr-greeting">Reports</h1>
      <p className="mgr-sub">Daily P&L, covers, and ticket averages.</p>
      <div className="mgr-report-table card">
        <div className="mgr-report-head">
          <span>Metric</span><span>Tonight</span><span>vs. Yesterday</span>
        </div>
        {REPORT_ROWS.map(r => (
          <div key={r.label} className="mgr-report-row">
            <span className="mgr-report-label">{r.label}</span>
            <span className="serif mgr-report-val">{r.value}</span>
            <span className={`mgr-report-delta ${r.up ? 'up' : 'dn'}`}>{r.delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ManagerPanel({ section: initialSection }: { section?: string }) {
  const sectionMap: Record<string, Section> = {
    inventory: 'inventory', staff: 'staff', reports: 'reports', roles: 'roles',
  };
  const [active, setActive] = useState<Section>((sectionMap[initialSection ?? ''] ?? 'overview') as Section);

  return (
    <div className="mgr-root">
      <div className="mgr-tabs">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`mgr-tab ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="mgr-body">
        {active === 'overview'   && <Overview  onNav={setActive} />}
        {active === 'inventory'  && <Inventory />}
        {active === 'staff'      && <StaffTab  onNav={setActive} />}
        {active === 'reports'    && <Reports   />}
        {active === 'roles'      && <RolesPanel />}
      </div>
    </div>
  );
}
