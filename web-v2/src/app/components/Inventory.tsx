import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, AlertTriangle, Package, TrendingDown, CheckCircle2, Edit2, Trash2, X, Save } from "lucide-react";
import { toast } from "./Toast";
import { inventoryApi, type ApiInventoryItem } from "../../services/api";

type StockLevel = "critical" | "low" | "ok" | "surplus";

interface InventoryItem {
  id: string; name: string; category: string; unit: string;
  currentQty: number; minQty: number; maxQty: number;
  unitCost: number | null; supplier: string; lastRestocked: string;
}

interface ItemForm {
  name: string; par: string; current: string; unit: string;
}

const UNITS = ["kg", "L", "pcs", "g", "ml"];

function getStockLevel(item: InventoryItem): StockLevel {
  const pct = item.currentQty / (item.minQty || 1);
  if (pct < 0.5) return "critical";
  if (pct < 1)   return "low";
  if (item.currentQty > item.maxQty * 0.85) return "surplus";
  return "ok";
}

const stockConfig: Record<StockLevel, { color: string; bg: string; label: string; icon: React.ElementType }> = {
  critical: { color: "#ff3b5c", bg: "rgba(255,59,92,0.1)",    label: "Critical",  icon: AlertTriangle },
  low:      { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   label: "Low Stock", icon: TrendingDown },
  ok:       { color: "#22c55e", bg: "rgba(34,197,94,0.1)",    label: "OK",        icon: CheckCircle2 },
  surplus:  { color: "#1e7fff", bg: "var(--cafyz-badge-bg)",   label: "Surplus",   icon: Package },
};

function mapRow(r: ApiInventoryItem): InventoryItem {
  return {
    id: r.id,
    name: r.name,
    category: "General",
    unit: r.unit,
    currentQty: r.current,
    minQty: r.par,
    maxQty: Math.max(r.par, r.current) * 2 || 1,
    unitCost: null,
    supplier: "",
    lastRestocked: "",
  };
}

export function Inventory() {
  const [search, setSearch] = useState("");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; item?: InventoryItem } | null>(null);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [form, setForm] = useState<ItemForm>({ name: "", par: "10", current: "0", unit: "kg" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await inventoryApi.list();
      setInventoryItems(rows.map(mapRow));
    } catch (e) {
      toast.error("Couldn't load inventory", (e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setForm({ name: "", par: "10", current: "0", unit: "kg" });
    setModal({ mode: "create" });
  };

  const openEdit = (item: InventoryItem) => {
    setForm({
      name: item.name,
      par: String(item.minQty),
      current: String(item.currentQty),
      unit: item.unit || "kg",
    });
    setModal({ mode: "edit", item });
  };

  const saveItem = async () => {
    const name = form.name.trim();
    const par = Number(form.par);
    const current = Number(form.current);
    if (!name) { toast.error("Name required"); return; }
    if (!Number.isFinite(par) || par < 0) { toast.error("Enter a valid par level"); return; }
    if (!Number.isFinite(current) || current < 0) { toast.error("Enter a valid stock quantity"); return; }
    setSaving(true);
    try {
      if (modal?.mode === "edit" && modal.item) {
        await inventoryApi.update(modal.item.id, { name, par, current, unit: form.unit });
        toast.success("Item updated", name);
      } else {
        await inventoryApi.create({ name, par, current, unit: form.unit });
        toast.success("Item added", name);
      }
      setModal(null);
      await load();
    } catch (e) {
      toast.error("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (item: InventoryItem) => {
    if (!window.confirm(`Delete "${item.name}" from inventory?`)) return;
    try {
      await inventoryApi.delete(item.id);
      toast.success("Item removed", item.name);
      await load();
    } catch (e) {
      toast.error("Delete failed", (e as Error).message);
    }
  };

  const applyRestock = async () => {
    if (!restockItem) return;
    const qty = Number(restockQty);
    if (!Number.isFinite(qty) || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    try {
      await inventoryApi.update(restockItem.id, { current: restockItem.currentQty + qty });
      toast.success("Stock updated", `${restockItem.name} +${qty}${restockItem.unit}`);
      setRestockItem(null);
      setRestockQty("");
      await load();
    } catch (e) {
      toast.error("Update failed", (e as Error).message);
    }
  };

  const filtered = inventoryItems
    .filter(item => search === "" || item.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const order = ["critical","low","ok","surplus"];
      return order.indexOf(getStockLevel(a)) - order.indexOf(getStockLevel(b));
    });

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["critical","low","ok","surplus"] as StockLevel[]).map(level => {
          const cfg = stockConfig[level];
          const Icon = cfg.icon;
          const count = inventoryItems.filter(i => getStockLevel(i) === level).length;
          return (
            <div key={level} className="rounded-2xl p-3 sm:p-4"
              style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} style={{ color: cfg.color }} />
                <span style={{ color: cfg.color, fontSize: "0.68rem", fontWeight: 600 }}>{cfg.label}</span>
              </div>
              <div style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem" }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1"
          style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
          <Search size={14} style={{ color: "var(--cafyz-muted)" }} />
          <input type="text" placeholder="Search ingredients..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[var(--cafyz-muted)]"
            style={{ color: "var(--cafyz-text)" }} />
        </div>
        <div className="flex gap-2">
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
            <Plus size={15} />
            <span className="hidden sm:inline">Add item</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
        <div className="grid grid-cols-12 gap-2 px-3 sm:px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b"
          style={{ color: "var(--cafyz-muted)", borderColor: "rgba(30,127,255,0.08)", fontFamily: "var(--font-mono)" }}>
          <div className="col-span-5 sm:col-span-4">Item</div>
          <div className="col-span-4 sm:col-span-4">Stock</div>
          <div className="col-span-3 hidden md:block">Par level</div>
          <div className="col-span-3 sm:col-span-4 md:col-span-4 text-right sm:text-left">Actions</div>
        </div>

        <div className="divide-y divide-[rgba(30,127,255,0.05)]">
          {filtered.map((item, i) => {
            const level = getStockLevel(item);
            const cfg = stockConfig[level];
            const Icon = cfg.icon;
            const pct = Math.min(100, (item.currentQty / item.maxQty) * 100);
            return (
              <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="grid grid-cols-12 gap-2 px-3 sm:px-4 py-3 items-center hover:bg-[rgba(30,127,255,0.02)] transition-all">
                <div className="col-span-5 sm:col-span-4 min-w-0">
                  <p style={{ color: "var(--cafyz-text)", fontSize: "0.82rem", fontWeight: 500 }} className="truncate">{item.name}</p>
                </div>
                <div className="col-span-4 sm:col-span-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={10} style={{ color: cfg.color }} />
                    <span style={{ color: cfg.color, fontSize: "0.68rem", fontWeight: 600 }}>
                      {item.currentQty}{item.unit}
                    </span>
                    <span style={{ color: "var(--cafyz-muted)", fontSize: "0.62rem" }}>/{item.minQty}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(30,127,255,0.08)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        background: level === "critical" ? "#ff3b5c" : level === "low" ? "#f59e0b" : level === "surplus" ? "#1e7fff" : "#22c55e",
                      }} />
                  </div>
                </div>
                <div className="col-span-3 hidden md:block">
                  <span style={{ color: "var(--cafyz-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                    par {item.minQty}{item.unit}
                  </span>
                </div>
                <div className="col-span-3 sm:col-span-4 md:col-span-4 flex justify-end sm:justify-start gap-1 flex-wrap">
                  {(level === "critical" || level === "low") && (
                    <button className="px-2 py-1 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff" }}
                      onClick={() => {
                        setRestockItem(item);
                        setRestockQty(String(Math.max(1, item.minQty - item.currentQty)));
                      }}>
                      Restock
                    </button>
                  )}
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-[rgba(30,127,255,0.08)]"
                    style={{ color: "var(--cafyz-muted)" }} title="Edit">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => void deleteItem(item)} className="p-1.5 rounded-lg hover:bg-[rgba(255,59,92,0.08)]"
                    style={{ color: "var(--cafyz-muted)" }} title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-md rounded-2xl p-5 space-y-4"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>
                  {modal.mode === "edit" ? "Edit Item" : "Add Item"}
                </h3>
                <button onClick={() => setModal(null)} style={{ color: "var(--cafyz-muted)" }}><X size={18} /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Name</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Par level</label>
                    <input type="number" min={0} value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                  <div>
                    <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Current stock</label>
                    <input type="number" min={0} value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
                  </div>
                </div>
                <div>
                  <label style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.78rem", display: "block", marginBottom: 4 }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button onClick={() => void saveItem()} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
                  <Save size={15} /> {modal.mode === "edit" ? "Save" : "Add"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {restockItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--cafyz-overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setRestockItem(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ background: "var(--cafyz-surface)", border: "1px solid rgba(30,127,255,0.2)" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 style={{ fontFamily: "var(--font-display)", color: "var(--cafyz-text)", fontWeight: 700 }}>Restock</h3>
                <button onClick={() => setRestockItem(null)} style={{ color: "var(--cafyz-muted)" }}><X size={18} /></button>
              </div>
              <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.85rem" }}>
                Add stock for <strong style={{ color: "var(--cafyz-text)" }}>{restockItem.name}</strong>
                {" "}(current {restockItem.currentQty}{restockItem.unit}, par {restockItem.minQty}{restockItem.unit})
              </p>
              <input type="number" min={1} value={restockQty} onChange={e => setRestockQty(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--cafyz-surface-2)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.12)" }} />
              <div className="flex gap-2">
                <button onClick={() => setRestockItem(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(30,127,255,0.06)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                  Cancel
                </button>
                <button onClick={() => void applyRestock()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
                  Add stock
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
