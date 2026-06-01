import { useState, useEffect } from 'react';
import { usersApi, type ApiUser } from '../services/api';
import { useAuth, ROLE_LABELS, type Role } from '../context/AuthContext';
import './RolesPanel.css';

const ROLES: Exclude<Role, 'owner' | 'founder'>[] = ['manager', 'cashier', 'waiter', 'kitchen'];

const ROLE_DESC: Record<Exclude<Role, 'owner' | 'founder'>, string> = {
  manager:  'Full access — all panels, role management, reports, and settings.',
  cashier:  'POS, inventory, reports, and role management access.',
  waiter:   'Floor plan, table management, and mobile order entry.',
  kitchen:  'Kitchen display system only — ticket flow and station view.',
};

const ROLE_COLOR: Record<Role, string> = {
  owner:   'var(--gold)',
  manager: 'var(--gold)',
  cashier: 'var(--success)',
  waiter:  '#60a5fa',
  kitchen: 'var(--warning)',
  founder: '#ef4444',
};

const STATUS_COLOR = { active: 'var(--success)', break: 'var(--warning)', off: 'var(--text3)' };

type DraftUser = {
  name: string; email: string; role: Exclude<Role,'owner'|'founder'>;
  status: 'active' | 'break' | 'off'; start_time: string;
};

const blank = (): DraftUser => ({ name: '', email: '', role: 'waiter', status: 'active', start_time: '18:00' });

export function RolesPanel() {
  const { user: me } = useAuth();
  const canEdit = me?.role === 'owner' || me?.role === 'manager' || me?.role === 'cashier';

  const [staff,         setStaff]        = useState<ApiUser[]>([]);
  const [filterRole,    setFilterRole]   = useState<Role | 'all'>('all');
  const [editId,        setEditId]       = useState<string | null>(null);
  const [draft,         setDraft]        = useState<DraftUser>(blank());
  const [adding,        setAdding]       = useState(false);
  const [confirmDelete, setConfirmDelete]= useState<string | null>(null);
  const [busy,          setBusy]         = useState(false);
  const [error,         setError]        = useState('');
  const [notice,        setNotice]       = useState('');
  const [loading,       setLoading]      = useState(true);

  useEffect(() => {
    usersApi.list()
      .then(setStaff)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const visible = filterRole === 'all'
    ? staff
    : staff.filter(s => s.role === filterRole);

  // ── Edit ──────────────────────────────────────────────────────────────────
  function startEdit(s: ApiUser) {
    setEditId(s.id);
    setDraft({ name: s.name, email: s.email, role: s.role as Exclude<Role,'owner'|'founder'>,
               status: s.status, start_time: s.start_time });
    setAdding(false);
  }

  async function saveEdit() {
    if (!editId) return;
    setBusy(true); setError('');
    try {
      const updated = await usersApi.update(editId, {
        name: draft.name, email: draft.email, role: draft.role,
        status: draft.status, start_time: draft.start_time,
      });
      setStaff(prev => prev.map(s => s.id === editId ? updated : s));
      setEditId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Add ───────────────────────────────────────────────────────────────────
  function startAdd() { setDraft(blank()); setAdding(true); setEditId(null); }

  async function confirmAdd() {
    if (!draft.name || !draft.email) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const created = await usersApi.create({
        name: draft.name, email: draft.email, role: draft.role,
        status: draft.status, start_time: draft.start_time,
        password: 'cafyz2026',
      }) as ApiUser & { pin_delivery?: { sent: boolean; message: string } };
      setStaff(prev => [...prev, created]);
      setNotice(created.pin_delivery?.message ?? 'User created and PIN generated.');
      setAdding(false);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function removeStaff(id: string) {
    setBusy(true); setError('');
    try {
      await usersApi.delete(id);
      setStaff(prev => prev.filter(s => s.id !== id));
      setConfirmDelete(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Status cycle ──────────────────────────────────────────────────────────
  async function cycleStatus(s: ApiUser) {
    if (!canEdit) return;
    const order: ApiUser['status'][] = ['active', 'break', 'off'];
    const next = order[(order.indexOf(s.status) + 1) % order.length];
    try {
      await usersApi.updateStatus(s.id, next);
      setStaff(prev => prev.map(u => u.id === s.id ? { ...u, status: next } : u));
    } catch (e) { setError((e as Error).message); }
  }

  const counts = ROLES.reduce(
    (acc, r) => ({ ...acc, [r]: staff.filter(s => s.role === r).length }),
    {} as Record<Exclude<Role,'owner'>, number>,
  );

  if (loading) return (
    <div className="roles-root">
      <p style={{ color: 'var(--text2)', padding: 32 }}>Loading staff…</p>
    </div>
  );

  return (
    <div className="roles-root">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="roles-header">
        <div>
          <p className="eyebrow">Team · Access Control</p>
          <h1 className="serif roles-title">Role Management</h1>
          <p className="roles-subtitle">
            {staff.length} staff members · {staff.filter(s => s.status === 'active').length} on floor
          </p>
        </div>
        {canEdit && (
          <button className="roles-add-btn" onClick={startAdd} disabled={busy}>+ Add Staff</button>
        )}
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {notice && <p style={{ color: 'var(--success)', fontSize: 13, marginBottom: 12 }}>{notice}</p>}

      {/* ── Role summary cards ───────────────────────────────────── */}
      <div className="roles-cards">
        {ROLES.map(r => (
          <button key={r}
            className={`roles-card ${filterRole === r ? 'active' : ''}`}
            style={{ '--rc': ROLE_COLOR[r] } as React.CSSProperties}
            onClick={() => setFilterRole(filterRole === r ? 'all' : r)}
          >
            <div className="roles-card-top">
              <span className="roles-card-count serif">{counts[r] ?? 0}</span>
              <span className="roles-card-badge">{ROLE_LABELS[r]}</span>
            </div>
            <p className="roles-card-desc">{ROLE_DESC[r]}</p>
          </button>
        ))}
      </div>

      {/* ── Add staff form ───────────────────────────────────────── */}
      {adding && (
        <div className="roles-form-row">
          <div className="roles-form-grid">
            <input placeholder="Full name"       value={draft.name}  onChange={e => setDraft(d => ({ ...d, name:  e.target.value }))} className="roles-input" />
            <input placeholder="Work email"      value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} className="roles-input" />
            <select value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value as DraftUser['role'] }))} className="roles-select">
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="roles-form-actions">
            <button className="roles-save-btn" onClick={confirmAdd} disabled={!draft.name || !draft.email || busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button className="roles-cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Staff table ──────────────────────────────────────────── */}
      <div className="roles-table-wrap">
        <div className="roles-table-head">
          <span>Member</span>
          <span>Role</span>
          <span>Status</span>
          <span>Start</span>
          {canEdit && <span>Actions</span>}
        </div>

        {visible.map(s => (
          <div key={s.id} className="roles-row">
            {editId === s.id ? (
              <>
                <div className="roles-row-member">
                  <div className="roles-avatar" style={{ background: 'rgba(139,92,246,0.18)', color: 'var(--gold)' }}>
                    {s.initials}
                  </div>
                  <div>
                    <input value={draft.name}  onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}  className="roles-input-sm" />
                    <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} className="roles-input-sm" placeholder="email" />
                  </div>
                </div>
                <select value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value as DraftUser['role'] }))} className="roles-select-sm">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value as DraftUser['status'] }))} className="roles-select-sm">
                  <option value="active">Active</option>
                  <option value="break">Break</option>
                  <option value="off">Off</option>
                </select>
                <span className="mono" style={{ color: 'var(--text2)', fontSize: 12 }}>{s.start_time}</span>
                <div className="roles-row-actions">
                  <button className="roles-save-btn sm" onClick={saveEdit} disabled={busy}>{busy ? '…' : 'Save'}</button>
                  <button className="roles-cancel-btn sm" onClick={() => setEditId(null)}>✕</button>
                </div>
              </>
            ) : (
              <>
                <div className="roles-row-member">
                  <div className="roles-avatar" style={{ background: `${ROLE_COLOR[s.role as Role]}18`, color: ROLE_COLOR[s.role as Role] }}>
                    {s.initials}
                  </div>
                  <div>
                    <p className="roles-row-name">{s.name}</p>
                    <p className="roles-row-email">{s.email}</p>
                  </div>
                </div>
                <span className="roles-role-pill" style={{ '--rc': ROLE_COLOR[s.role as Role] } as React.CSSProperties}>
                  {ROLE_LABELS[s.role as Role]}
                </span>
                <button
                  className="roles-status-pill"
                  style={{ color: STATUS_COLOR[s.status] }}
                  onClick={() => cycleStatus(s)}
                  title={canEdit ? 'Click to cycle status' : undefined}
                >
                  <span className="roles-status-dot" style={{ background: STATUS_COLOR[s.status] }} />
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </button>
                <span className="mono roles-start">{s.start_time}</span>
                {canEdit && (
                  <div className="roles-row-actions">
                    <button className="roles-edit-btn" onClick={() => startEdit(s)}>Edit</button>
                    {confirmDelete === s.id ? (
                      <>
                        <button className="roles-del-confirm" onClick={() => removeStaff(s.id)} disabled={busy}>
                          {busy ? '…' : 'Confirm'}
                        </button>
                        <button className="roles-cancel-btn sm" onClick={() => setConfirmDelete(null)}>✕</button>
                      </>
                    ) : (
                      <button className="roles-del-btn" onClick={() => setConfirmDelete(s.id)}>Remove</button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {visible.length === 0 && (
          <p className="roles-empty">No staff members with this role.</p>
        )}
      </div>
    </div>
  );
}
