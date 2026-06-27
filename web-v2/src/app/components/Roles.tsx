import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Trash2, Shield, Eye, EyeOff, ChevronDown, ChevronUp, Check, X, UserCog } from "lucide-react";
import { toast } from "./Toast";
import { usersApi, type ApiUser } from "../../services/api";
import {
  ACCESS_MANAGED_SCREENS, effectiveScreenAccess, sanitizeScreenAccess,
  type AccessLevel, type ScreenAccessMap, type ScreenId,
} from "../../config/screenAccess";

type Role = "owner" | "manager" | "cashier" | "waiter" | "kitchen";
type Access = AccessLevel;

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  pin: string;
  active: boolean;
  access_json?: string;
}

const screens = ACCESS_MANAGED_SCREENS;

const defaultMatrix: Record<Role, ScreenAccessMap> = {
  owner: Object.fromEntries(screens.map(s => [s.id, "edit"])) as ScreenAccessMap,
  manager: Object.fromEntries(screens.map(s => [s.id, s.id === "roles" ? "view" : "edit"])) as ScreenAccessMap,
  cashier: {
    pos: "edit", menu: "edit", inventory: "edit", reports: "view", roles: "view", license: "view",
  },
  waiter: { waiter: "edit", license: "view" },
  kitchen: { kds: "edit", license: "view" },
};

const roleColors: Record<Role, string> = {
  owner: "#a855f7", manager: "#1e7fff", cashier: "#22d3ee", waiter: "#00c6ff", kitchen: "#f59e0b",
};

const accessCycle: Access[] = ["none", "view", "edit"];
const accessColors: Record<Access, { color: string; bg: string }> = {
  none: { color: "var(--cafyz-muted)", bg: "rgba(107,130,160,0.08)" },
  view: { color: "#1e7fff", bg: "var(--cafyz-border)" },
  edit: { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
};

export function Roles() {
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("manager");
  const matrix = defaultMatrix;
  const [accessEditId, setAccessEditId] = useState<string | null>(null);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", email: "", role: "waiter" as Role, active: true });
  const [savingUser, setSavingUser] = useState(false);
  const [accessDraft, setAccessDraft] = useState<ScreenAccessMap>({});
  const [savingAccess, setSavingAccess] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "waiter" as Role, password: "", pin: "" });

  const load = useCallback(async () => {
    try {
      const us = await usersApi.list();
      setStaffUsers(us.map((u: ApiUser) => ({
        id: u.id, name: u.name, email: u.email, role: u.role as Role, pin: "", active: u.status === "active",
        access_json: u.access_json,
      })));
    } catch (e) {
      toast.error("Couldn't load users", (e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const startAccessEdit = (user: StaffUser) => {
    setAccessEditId(user.id);
    setEditUserId(null);
    setAccessDraft(effectiveScreenAccess(user.role, user.access_json));
    setShowAddForm(false);
  };

  const startUserEdit = (user: StaffUser) => {
    setEditUserId(user.id);
    setAccessEditId(null);
    setEditDraft({ name: user.name, email: user.email, role: user.role, active: user.active });
    setShowAddForm(false);
  };

  const saveUserEdit = async () => {
    if (!editUserId) return;
    const user = staffUsers.find(u => u.id === editUserId);
    if (!user) return;
    if (!editDraft.name.trim() || !editDraft.email.trim()) {
      toast.error("Missing fields", "Name and email are required");
      return;
    }
    if (user.role === "owner" && editDraft.role !== "owner") {
      toast.error("Can't change owner role", "The owner must remain an owner");
      return;
    }
    setSavingUser(true);
    try {
      await usersApi.update(editUserId, {
        name: editDraft.name.trim(),
        email: editDraft.email.trim().toLowerCase(),
        ...(user.role !== "owner" ? { role: editDraft.role } : {}),
      });
      const targetStatus = editDraft.active ? "active" : "off";
      if ((user.active ? "active" : "off") !== targetStatus) {
        await usersApi.updateStatus(editUserId, targetStatus);
      }
      toast.success("User updated", editDraft.name.trim());
      setEditUserId(null);
      await load();
    } catch (e) {
      toast.error("Couldn't save user", (e as Error).message);
    } finally {
      setSavingUser(false);
    }
  };

  const saveAccess = async () => {
    if (!accessEditId) return;
    setSavingAccess(true);
    try {
      await usersApi.update(accessEditId, { access_json: sanitizeScreenAccess(accessDraft) });
      toast.success("Access updated", "Permissions saved for this team member");
      setAccessEditId(null);
      await load();
    } catch (e) {
      toast.error("Couldn't save access", (e as Error).message);
    } finally {
      setSavingAccess(false);
    }
  };

  const removeUser = async (u: StaffUser) => {
    if (u.role === "owner") { toast.error("Can't remove owner", "The owner account cannot be deleted"); return; }
    try {
      await usersApi.delete(u.id);
      setStaffUsers(prev => prev.filter(x => x.id !== u.id));
      toast.success("User removed", `${u.name} has been removed`);
    } catch (e) {
      toast.error("Couldn't remove user", (e as Error).message);
    }
  };

  const addUser = async () => {
    if (!newUser.name || !newUser.email) { toast.error("Missing fields", "Please fill in name and email"); return; }
    try {
      await usersApi.create({
        name: newUser.name.trim(),
        email: newUser.email.trim().toLowerCase(),
        role: newUser.role,
        password: newUser.password.length >= 6 ? newUser.password : undefined,
        pin: newUser.pin.length === 4 ? newUser.pin : undefined,
      });
      setShowAddForm(false);
      toast.success("Team member added", `${newUser.name} can now sign in as ${newUser.role}`);
      setNewUser({ name: "", email: "", role: "waiter", password: "", pin: "" });
      await load();
    } catch (e) {
      toast.error("Couldn't add member", (e as Error).message);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700 }}>User Roles & Access</h2>
          <p style={{ color: "var(--cafyz-muted)", fontSize: "0.78rem" }}>Manage team members and their permissions</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* User list */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b"
          style={{ color: "var(--cafyz-muted)", borderColor: "rgba(30,127,255,0.08)", fontFamily: "var(--font-mono)" }}>
          <div className="col-span-4">Name</div>
          <div className="col-span-3 hidden sm:block">Email</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2 hidden md:block">Status</div>
          <div className="col-span-1">Actions</div>
        </div>
        {staffUsers.map((user, i) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
            className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b hover:bg-[rgba(30,127,255,0.03)] transition-all"
            style={{ borderColor: "rgba(30,127,255,0.06)" }}
          >
            <div className="col-span-4 flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${roleColors[user.role]}18` }}
              >
                <span style={{ color: roleColors[user.role], fontWeight: 700, fontSize: "0.72rem" }}>
                  {user.name.split(" ").map(n => n[0]).join("")}
                </span>
              </div>
              <div>
                <p style={{ color: "var(--cafyz-text)", fontSize: "0.85rem", fontWeight: 500 }}>{user.name}</p>
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>PIN: ••••</p>
              </div>
            </div>
            <div className="col-span-3 hidden sm:block" style={{ color: "var(--cafyz-muted)", fontSize: "0.78rem" }}>{user.email}</div>
            <div className="col-span-2">
              <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium"
                style={{ background: `${roleColors[user.role]}15`, color: roleColors[user.role] }}>
                {user.role}
              </span>
            </div>
            <div className="col-span-2 hidden md:block">
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={user.active ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(107,130,160,0.1)", color: "var(--cafyz-muted)" }}>
                {user.active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="col-span-1 flex gap-1">
              <button
                onClick={() => startUserEdit(user)}
                title="Edit profile"
                className="p-1.5 rounded-lg hover:bg-[rgba(30,127,255,0.08)] text-[var(--cafyz-muted)] hover:text-[#1e7fff] transition-all">
                <UserCog size={13} />
              </button>
              <button
                onClick={() => startAccessEdit(user)}
                title="Edit screen access"
                className="p-1.5 rounded-lg hover:bg-[rgba(30,127,255,0.08)] text-[var(--cafyz-muted)] hover:text-[#1e7fff] transition-all">
                <Shield size={13} />
              </button>
              <button
                onClick={() => removeUser(user)}
                className="p-1.5 rounded-lg hover:bg-[rgba(255,59,92,0.08)] text-[var(--cafyz-muted)] hover:text-[#ff3b5c] transition-all">
                <Trash2 size={13} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Access matrix */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
        <button
          onClick={() => setShowMatrix(m => !m)}
          className="w-full flex items-center justify-between px-4 py-4"
        >
          <div className="flex items-center gap-2">
            <Shield size={16} style={{ color: "#1e7fff" }} />
            <span style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 600 }}>Default Role Access</span>
          </div>
          {showMatrix ? <ChevronUp size={16} style={{ color: "var(--cafyz-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--cafyz-muted)" }} />}
        </button>
        <AnimatePresence>
          {showMatrix && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="px-4 pb-2" style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>
                Reference only — use Edit Access on a team member to save custom permissions.
              </p>
              {/* Role tabs */}
              <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
                {(Object.keys(roleColors) as Role[]).map(r => (
                  <button key={r} onClick={() => setSelectedRole(r)}
                    className="px-3 py-1.5 rounded-full text-xs capitalize flex-shrink-0 transition-all font-medium"
                    style={selectedRole === r ? { background: `${roleColors[r]}20`, color: roleColors[r], border: `1px solid ${roleColors[r]}40` } : { background: "var(--cafyz-surface-2)", color: "var(--cafyz-muted)" }}>
                    {r}
                  </button>
                ))}
              </div>
              {/* Matrix table */}
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
                  <thead>
                    <tr>
                      <th style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", textAlign: "left", paddingBottom: 8, fontFamily: "var(--font-mono)" }}>Screen</th>
                      <th style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", textAlign: "center", paddingBottom: 8, fontFamily: "var(--font-mono)" }}>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screens.map(screen => {
                      const access = matrix[selectedRole][screen.id] ?? "none";
                      const cfg = accessColors[access];
                      return (
                        <tr key={screen.id}>
                          <td style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.82rem", paddingRight: 12, paddingBottom: 6 }}>{screen.label}</td>
                          <td style={{ paddingBottom: 6 }}>
                            <span
                              className="px-3 py-1 rounded-lg text-xs font-semibold capitalize inline-block"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}22`, minWidth: 60 }}
                            >
                              {access}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add user modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowAddForm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>Add Team Member</h3>
                <button onClick={() => setShowAddForm(false)} style={{ color: "var(--cafyz-muted)" }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                {[{ label: "Full Name", field: "name", type: "text", placeholder: "Ravi Sharma" },
                  { label: "Email", field: "email", type: "email", placeholder: "ravi@restaurant.com" }].map(f => (
                  <div key={f.field}>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={(newUser as any)[f.field]}
                      onChange={e => setNewUser(u => ({ ...u, [f.field]: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)]"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                ))}
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Role</label>
                  <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value as Role }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }}>
                    {(Object.keys(roleColors) as Role[]).filter(r => r !== "owner").map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Password</label>
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--cafyz-surface-2)", border: "1px solid rgba(30,127,255,0.12)" }}>
                      <input type={showPin ? "text" : "password"} placeholder="••••••••" value={newUser.password}
                        onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                        className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--cafyz-muted)]" style={{ color: "var(--cafyz-text)" }} />
                      <button onClick={() => setShowPin(p => !p)} style={{ color: "var(--cafyz-muted)" }}>
                        {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>4-digit PIN</label>
                    <input type="text" maxLength={4} placeholder="1234" value={newUser.pin}
                      onChange={e => setNewUser(u => ({ ...u, pin: e.target.value.replace(/\D/g, "") }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[var(--cafyz-muted)]"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)", fontFamily: "var(--font-mono)", letterSpacing: "0.3em" }} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button
                  onClick={addUser}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
                  <Check size={15} /> Add Member
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {accessEditId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setAccessEditId(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>Edit Screen Access</h3>
                <button onClick={() => setAccessEditId(null)} style={{ color: "var(--cafyz-muted)" }}><X size={18} /></button>
              </div>
              <p style={{ color: "var(--cafyz-muted)", fontSize: "0.78rem" }}>
                Override default role permissions for {staffUsers.find(u => u.id === accessEditId)?.name ?? "this user"}.
              </p>
              <div className="space-y-2">
                {screens.map(screen => {
                  const access = accessDraft[screen.id] ?? "none";
                  const cfg = accessColors[access];
                  return (
                    <div key={screen.id} className="flex items-center justify-between py-1.5">
                      <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.82rem" }}>{screen.label}</span>
                      <button
                        onClick={() => {
                          const next = accessCycle[(accessCycle.indexOf(access) + 1) % 3];
                          setAccessDraft(d => ({ ...d, [screen.id]: next }));
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold capitalize"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}22`, minWidth: 60 }}
                      >
                        {access}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setAccessEditId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button onClick={() => void saveAccess()} disabled={savingAccess}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: savingAccess ? 0.7 : 1 }}>
                  <Check size={15} /> Save Access
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setEditUserId(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>Edit Team Member</h3>
                <button onClick={() => setEditUserId(null)} style={{ color: "var(--cafyz-muted)" }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Full Name</label>
                  <input type="text" value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Email</label>
                  <input type="email" value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
                {editDraft.role !== "owner" && (
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Role</label>
                    <select value={editDraft.role} onChange={e => setEditDraft(d => ({ ...d, role: e.target.value as Role }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none capitalize"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }}>
                      {(Object.keys(roleColors) as Role[]).filter(r => r !== "owner").map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
                <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--cafyz-surface-2)", border: "1px solid rgba(30,127,255,0.08)" }}>
                  <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.82rem" }}>Active</span>
                  <button type="button" onClick={() => setEditDraft(d => ({ ...d, active: !d.active }))}
                    className="rounded-full relative transition-all"
                    style={{ background: editDraft.active ? "#22c55e" : "rgba(30,127,255,0.12)", width: 40, height: 22 }}>
                    <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                      style={{ left: editDraft.active ? "calc(100% - 18px)" : 2 }} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditUserId(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button onClick={() => void saveUserEdit()} disabled={savingUser}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: savingUser ? 0.7 : 1 }}>
                  <Check size={15} /> Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
