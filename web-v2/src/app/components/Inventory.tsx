import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { Plus, Search, AlertTriangle, Package, TrendingDown, CheckCircle2 } from "lucide-react";
import { toast } from "./Toast";
import { inventoryApi, type ApiInventoryItem } from "../../services/api";

type StockLevel = "critical" | "low" | "ok" | "surplus";

interface InventoryItem {
  id: string; name: string; category: string; unit: string;
  currentQty: number; minQty: number; maxQty: number;
  unitCost: number | null; supplier: string; lastRestocked: string;
}

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
  surplus:  { color: "#1e7fff", bg: "rgba(30,127,255,0.1)",   label: "Surplus",   icon: Package },
};

export function Inventory() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await inventoryApi.list();
      setInventoryItems(rows.map((r: ApiInventoryItem) => ({
        id: r.id,
        name: r.name,
        category: "General",
        unit: r.unit,
        currentQty: r.current,
        minQty: r.par,
        maxQty: Math.max(r.par, r.current) * 2 || 1,
        unitCost: null,        // backend has no cost field
        supplier: "",          // backend has no supplier field
        lastRestocked: "",
      })));
    } catch (e) {
      toast.error("Couldn't load inventory", (e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const categories = ["All", ...Array.from(new Set(inventoryItems.map(i => i.category)))];

  const filtered = inventoryItems
    .filter(item =>
      (category === "All" || item.category === category) &&
      (search === "" || item.name.toLowerCase().includes(search.toLowerCase()))
    )
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
              style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={12} style={{ color: cfg.color }} />
                <span style={{ color: cfg.color, fontSize: "0.68rem", fontWeight: 600 }}>{cfg.label}</span>
              </div>
              <div style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.4rem" }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 flex-1"
          style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
          <Search size={14} style={{ color: "#6b82a0" }} />
          <input type="text" placeholder="Search ingredients..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-[#6b82a0]"
            style={{ color: "#e8eef8" }} />
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1"
            style={{ minWidth: 0 }}>
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all flex-shrink-0 font-medium"
                style={category === c
                  ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }
                  : { background: "#0d1326", color: "#6b82a0", border: "1px solid rgba(30,127,255,0.1)" }}>
                {c}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
            <Plus size={15} />
            <span className="hidden sm:inline">Restock</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
        {/* Header */}
        <div className="grid grid-cols-12 gap-2 px-3 sm:px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b"
          style={{ color: "#6b82a0", borderColor: "rgba(30,127,255,0.08)", fontFamily: "var(--font-mono)" }}>
          <div className="col-span-5 sm:col-span-4">Item</div>
          <div className="col-span-3 hidden sm:block">Category</div>
          <div className="col-span-4 sm:col-span-3">Stock</div>
          <div className="col-span-3 hidden md:block">Par level</div>
          <div className="col-span-3 sm:col-span-2 md:col-span-1 text-right sm:text-left">Action</div>
        </div>

        {/* Rows */}
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
                  <p style={{ color: "#e8eef8", fontSize: "0.82rem", fontWeight: 500 }} className="truncate">{item.name}</p>
                  {item.supplier && <p style={{ color: "#6b82a0", fontSize: "0.67rem" }} className="truncate">{item.supplier}</p>}
                </div>
                <div className="col-span-3 hidden sm:block">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(30,127,255,0.08)", color: "#1e7fff" }}>
                    {item.category}
                  </span>
                </div>
                <div className="col-span-4 sm:col-span-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={10} style={{ color: cfg.color }} />
                    <span style={{ color: cfg.color, fontSize: "0.68rem", fontWeight: 600 }}>
                      {item.currentQty}{item.unit}
                    </span>
                    <span style={{ color: "#6b82a0", fontSize: "0.62rem" }}>/{item.minQty}</span>
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
                  <span style={{ color: "#a8bdd4", fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
                    {item.maxQty ? `par ${item.minQty}${item.unit}` : "—"}
                  </span>
                </div>
                <div className="col-span-3 sm:col-span-2 md:col-span-1 flex justify-end sm:justify-start">
                  {(level === "critical" || level === "low") && (
                    <button className="px-2 py-1 rounded-lg text-xs font-semibold"
                      style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff" }}>
                      Order
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
