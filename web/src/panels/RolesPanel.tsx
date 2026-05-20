import { useState } from 'react';
import { useAuth, ROLE_LABELS, type Role } from '../context/AuthContext';
import { INITIAL_STAFF, type StaffMember } from '../data/staff';
import './RolesPanel.css';

const ROLES: Role[] = ['manager', 'cashier', 'waiter', 'kitchen'];

const ROLE_DESC: Record<Role, string> = {
  manager:  'Full access — all panels, role management, reports, and settings.',
  cashier:  'POS, inventory, reports, and role management access.',
  waiter:   'Floor plan, table management, and mobile order entry.',
  kitchen:  'Kitchen display system only — ticket flow and station view.',
};

const ROLE_COLOR: Record<Role, string> = {
  manager: 'var(--gold)',
  cashier: 'var(--success)',
  waiter:  '#60a5fa',
  kitchen: 'var(--warning)',
};

const STATUS_COLOR = { active: 'var(--success)', break: 'var(--warning)', off: 'var(--text3)' };

const blank = (): Omit<StaffMember, 'id'> => ({
  name: '', initials: '', email: '', role: 'waiter', status: 'active', startTime: '18:00', pin: '',
});

let nextId = 100;

export function RolesPanel() {
  const { user } = useAuth();
  const canEdit = user?.role === 'manager' || user?.role === 'cashier';

  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [filterRole, setFilterRole] = useState<Role | 'all'>('all');
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<StaffMember, 'id'>>(blank());
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const visible = filterRole === 'all' ? staff : staff.filter(s => s.role === filterRole);

  function startEdit(s: StaffMember) {
    setEditId(s.id);
    setDraft({ name: s.name, initials: s.initials, email: s.email, role: s.role, status: s.status, startTime: s.startTime, pin: s.pin });
    setAdding(false);
  }

  function saveEdit() {
    setStaff(prev => prev.map(s => s.id === editId ? { ...s, ...draft } : s));
    setEditId(null);
  }

  function startAdd() {
    setDraft(blank());
    setAdding(true);
    setEditId(null);
  }

  function confirmAdd() {
    const initials = draft.initials || draft.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    setStaff(prev => [...prev, { id: String(nextId++), ...draft, initials }]);
    setAdding(false);
  }

  function removeStaff(id: string) {
    setStaff(prev => prev.filter(s => s.id !== id));
    setConfirmDelete(null);
  }

  function cycleStatus(id: string) {
    const order: StaffMember['status'][] = ['active', 'break', 'off'];
    setStaff(prev => prev.map(s => {
      if (s.id !== id) return s;
      const next = order[(order.indexOf(s.status) + 1) % order.length];
      return { ...s, status: next };
    }));
  }

  const counts = ROLES.reduce((acc, r) => ({ ...acc, [r]: staff.filter(s => s.role === r).length }), {} as Record<Role, number>);

  return (
    <div className="roles-root">
      {/* Header */}
      <div className="roles-header">
        <div>
          <p className="eyebrow">Team · Access Control</p>
          <h1 className="serif roles-title">Role Management</h1>
          <p className="roles-subtitle">{staff.length} staff members · {staff.filter(s => s.status === 'active').length} on floor</p>
        </div>
        {canEdit && (
          <button className="roles-add-btn" onClick={startAdd}>+ Add Staff</button>
        )}
      </div>

      {/* Role summary cards */}
      <div className="roles-cards">
        {ROLES.map(r => (
          <button
            key={r}
            className={`roles-card ${filterRole === r ? 'active' : ''}`}
            style={{ '--rc': ROLE_COLOR[r] } as React.CSSProperties}
            onClick={() => setFilterRole(filterRole === r ? 'all' : r)}
          >
            <div className="roles-card-top">
              <span className="roles-card-count serif">{counts[r]}</span>
              <span className="roles-card-badge">{ROLE_LABELS[r]}</span>
            </div>
            <p className="roles-card-desc">{ROLE_DESC[r]}</p>
          </button>
        ))}
      </div>

      {/* Add staff form */}
      {adding && (
        <div className="roles-form-row">
          <div className="roles-form-grid">
            <input placeholder="Full name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className="roles-input" />
            <input placeholder="Email" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} className="roles-input" />
            <input placeholder="PIN (4 digits)" maxLength={4} value={draft.pin} onChange={e => setDraft(d => ({ ...d, pin: e.target.value }))} className="roles-input" />
            <select value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value as Role }))} className="roles-select">
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="roles-form-actions">
            <button className="roles-save-btn" onClick={confirmAdd} disabled={!draft.name || !draft.email}>Save</button>
            <button className="roles-cancel-btn" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Staff table */}
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
                  <div className="roles-avatar" style={{ background: 'rgba(139,92,246,0.18)', color: 'var(--gold)' }}>{s.initials}</div>
                  <div>
                    <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className="roles-input-sm" />
                    <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} className="roles-input-sm" placeholder="email" />
                  </div>
                </div>
                <select value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value as Role }))} className="roles-select-sm">
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value as StaffMember['status'] }))} className="roles-select-sm">
                  <option value="active">Active</option>
                  <option value="break">Break</option>
                  <option value="off">Off</option>
                </select>
                <span className="mono" style={{ color: 'var(--text2)', fontSize: 12 }}>{s.startTime}</span>
                <div className="roles-row-actions">
                  <button className="roles-save-btn sm" onClick={saveEdit}>Save</button>
                  <button className="roles-cancel-btn sm" onClick={() => setEditId(null)}>✕</button>
                </div>
              </>
            ) : (
              <>
                <div className="roles-row-member">
                  <div className="roles-avatar" style={{ background: `${ROLE_COLOR[s.role]}18`, color: ROLE_COLOR[s.role] }}>{s.initials}</div>
                  <div>
                    <p className="roles-row-name">{s.name}</p>
                    <p className="roles-row-email">{s.email}</p>
                  </div>
                </div>
                <span className="roles-role-pill" style={{ '--rc': ROLE_COLOR[s.role] } as React.CSSProperties}>
                  {ROLE_LABELS[s.role]}
                </span>
                <button
                  className="roles-status-pill"
                  style={{ color: STATUS_COLOR[s.status] }}
                  onClick={() => canEdit && cycleStatus(s.id)}
                  title={canEdit ? 'Click to cycle status' : undefined}
                >
                  <span className="roles-status-dot" style={{ background: STATUS_COLOR[s.status] }} />
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </button>
                <span className="mono roles-start">{s.startTime}</span>
                {canEdit && (
                  <div className="roles-row-actions">
                    <button className="roles-edit-btn" onClick={() => startEdit(s)}>Edit</button>
                    {confirmDelete === s.id ? (
                      <>
                        <button className="roles-del-confirm" onClick={() => removeStaff(s.id)}>Confirm</button>
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
