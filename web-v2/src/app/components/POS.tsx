import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Plus, Minus, Trash2, Printer, ChevronDown, ChevronUp,
  CreditCard, Banknote, X, Check, Wifi, Bluetooth, Usb,
  ReceiptText, ShoppingCart,
} from "lucide-react";
import { toast } from "./Toast";
import {
  menuApi, menuCategoriesApi, ordersApi, restaurantApi, tablesApi,
  type ApiMenuItem, type ApiMenuCategory, type ApiTable, type ApiRestaurant,
} from "../../services/api";
import { getCurrencySymbol } from "../../utils/currency";
import { useAppNav } from "../nav";

// A cart line carries the menu item id (id), and — once the bill is a live
// kitchen-sent order — its backing order_item id so edits persist server-side.
interface CartItem { id: string; name: string; price: number; qty: number; emoji: string; orderItemId?: string; addedNow?: boolean }
type PaymentState = "open" | "sent" | "card" | "cash" | "comped";

// Relative "since" label for the pending-bills strip.
function relSince(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function PrinterPopover({ onClose, kitchen, cashier }: { onClose: () => void; kitchen?: string | null; cashier?: string | null }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="absolute bottom-14 right-0 w-60 rounded-xl p-2.5 z-50"
      style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.2)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5">
          <Printer size={13} style={{ color: "#1e7fff" }} />
          <span style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8rem" }}>Printers</span>
        </div>
        <button onClick={onClose} className="p-0.5" style={{ color: "#6b82a0" }}><X size={14} /></button>
      </div>

      <div className="space-y-1.5">
        {[
          { Icon: ReceiptText, role: "Kitchen", name: kitchen },
          { Icon: CreditCard, role: "Cashier", name: cashier },
        ].map(({ Icon, role, name }) => (
          <div key={role} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            style={{ background: "rgba(30,127,255,0.05)", border: "1px solid rgba(30,127,255,0.08)" }}>
            <Icon size={14} style={{ color: "#1e7fff", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p style={{ color: "#6b82a0", fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>{role}</p>
              <p style={{ color: name ? "#e8eef8" : "#6b82a0", fontSize: "0.72rem", fontWeight: 500 }} className="truncate">{name || "Not configured"}</p>
            </div>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: name ? "#22c55e" : "#6b82a0" }} />
          </div>
        ))}
      </div>

      <p style={{ color: "#6b82a0", fontSize: "0.62rem", lineHeight: 1.45, marginTop: 8, paddingInline: 2 }}>
        Tickets auto-print on charge. Pair printers in the mobile app.
      </p>
    </motion.div>
  );
}

// ── Cart Panel (shared between desktop sidebar & mobile sheet) ───────────────
function CartPanel({
  cart, selectedTable, tables, isParcel, editMode, breakdownOpen, showPrinter, charged, busy,
  cur, subtotal, service, tax, grandTotal, serviceRate, taxRate, taxLabel, kitchenPrinter, cashierPrinter,
  sendable, onSend,
  onTableChange, onParcelToggle, onEditToggle, onBreakdownToggle, onPrinterToggle,
  onUpdateQty, onClear, onCharge, onCash, onClose,
  isMobile,
}: {
  cart: CartItem[]; selectedTable: string; tables: ApiTable[]; isParcel: boolean;
  editMode: boolean; breakdownOpen: boolean; showPrinter: boolean; charged: boolean; busy: boolean;
  cur: string; subtotal: number; service: number; tax: number; grandTotal: number;
  serviceRate: number; taxRate: number; taxLabel: string; kitchenPrinter?: string | null; cashierPrinter?: string | null;
  sendable: boolean; onSend: () => void;
  onTableChange: (t: string) => void; onParcelToggle: () => void; onEditToggle: () => void;
  onBreakdownToggle: () => void; onPrinterToggle: () => void;
  onUpdateQty: (id: string, d: number) => void; onClear: () => void;
  onCharge: () => void; onCash: () => void; onClose?: () => void;
  isMobile?: boolean;
}) {
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 space-y-3 border-b" style={{ borderColor: "rgba(30,127,255,0.1)" }}>
        {isMobile && (
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1rem" }}>
              Order Bill
            </h3>
            <button onClick={onClose} className="p-2 rounded-xl" style={{ background: "rgba(30,127,255,0.08)", color: "#6b82a0" }}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label style={{ color: "#6b82a0", fontSize: "0.68rem", display: "block", marginBottom: 4 }}>Table</label>
            <select value={selectedTable} onChange={e => onTableChange(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#0d1326", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.15)", fontFamily: "var(--font-mono)" }}>
              <option value="">Select table…</option>
              {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <label style={{ color: "#6b82a0", fontSize: "0.68rem" }}>Parcel</label>
            <button onClick={onParcelToggle} className="w-11 h-6 rounded-full relative transition-all"
              style={{ background: isParcel ? "#1e7fff" : "rgba(30,127,255,0.12)" }}>
              <div className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                style={{ left: isParcel ? "calc(100% - 20px)" : 4 }} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: "#6b82a0", fontSize: "0.73rem" }}>
            {itemCount} item{itemCount !== 1 ? "s" : ""}
            {isParcel && <span className="ml-2 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(0,198,255,0.1)", color: "#00c6ff" }}>📦 Parcel</span>}
          </span>
          <div className="flex gap-1">
            <button onClick={onEditToggle} className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={editMode ? { background: "rgba(245,158,11,0.12)", color: "#f59e0b" } : { background: "rgba(30,127,255,0.06)", color: "#6b82a0" }}>
              Edit Bill
            </button>
            <button onClick={onClear} className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ background: "rgba(255,59,92,0.08)", color: "#ff3b5c" }}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
        <AnimatePresence>
          {cart.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-32 gap-2">
              <ReceiptText size={24} style={{ color: "#6b82a0" }} />
              <p style={{ color: "#6b82a0", fontSize: "0.78rem" }}>No items — tap menu to add</p>
            </motion.div>
          )}
          {cart.map(item => (
            <motion.div key={item.orderItemId ?? item.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="flex items-center gap-2 p-2.5 rounded-xl"
              style={{ background: item.addedNow ? "rgba(0,198,255,0.07)" : "rgba(30,127,255,0.04)", border: `1px solid ${item.addedNow ? "rgba(0,198,255,0.25)" : "rgba(30,127,255,0.08)"}` }}>
              <span className="text-xl flex-shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 500 }} className="truncate">{item.name}</p>
                <p style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{cur}{(item.price * item.qty)}</p>
              </div>
              {editMode ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button disabled={busy} onClick={() => onUpdateQty(item.id, -1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255,59,92,0.1)" }}>
                    <Minus size={12} style={{ color: "#ff3b5c" }} />
                  </button>
                  <span style={{ color: "#e8eef8", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.85rem", minWidth: 18, textAlign: "center" }}>
                    {item.qty}
                  </span>
                  <button disabled={busy} onClick={() => onUpdateQty(item.id, 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(30,127,255,0.1)" }}>
                    <Plus size={12} style={{ color: "#1e7fff" }} />
                  </button>
                  <button disabled={busy} onClick={() => onUpdateQty(item.id, -item.qty)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center ml-0.5"
                    style={{ background: "rgba(255,59,92,0.08)" }}>
                    <Trash2 size={12} style={{ color: "#ff3b5c" }} />
                  </button>
                </div>
              ) : (
                <span style={{ color: "#a8bdd4", fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 600, flexShrink: 0 }}>×{item.qty}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Totals + actions */}
      <div className="flex-shrink-0 p-3 space-y-3 border-t" style={{ borderColor: "rgba(30,127,255,0.1)" }}>
        <button onClick={onBreakdownToggle} className="w-full flex items-center justify-between px-1">
          <span style={{ color: "#6b82a0", fontSize: "0.73rem" }}>Price breakdown</span>
          {breakdownOpen ? <ChevronUp size={14} style={{ color: "#6b82a0" }} /> : <ChevronDown size={14} style={{ color: "#6b82a0" }} />}
        </button>
        <AnimatePresence>
          {breakdownOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-1.5">
              {[["Subtotal", subtotal], [`Service (${serviceRate}%)`, service], [`${taxLabel} (${taxRate}%)`, tax]].map(([l, v]) => (
                <div key={l as string} className="flex justify-between">
                  <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{l}</span>
                  <span style={{ color: "#a8bdd4", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{cur}{(v as number).toFixed(0)}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between px-3 py-3 rounded-xl"
          style={{ background: "rgba(30,127,255,0.08)", border: "1px solid rgba(30,127,255,0.15)" }}>
          <span style={{ color: "#a8bdd4", fontWeight: 600, fontSize: "0.88rem" }}>Grand Total</span>
          <span style={{ color: "#fff", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "1.4rem" }}>
            {cur}{grandTotal.toFixed(0)}
          </span>
        </div>

        {/* Dine-in: place the order for this table (fires kitchen ticket, no payment yet) */}
        {sendable && (
          <motion.button whileTap={{ scale: 0.97 }} disabled={busy} onClick={onSend}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)", color: "#fff", opacity: busy ? 0.6 : 1 }}>
            <ReceiptText size={15} /> Send to Kitchen
          </motion.button>
        )}

        <div className="flex gap-2 relative">
          <motion.button whileTap={{ scale: 0.95 }} disabled={busy} onClick={onCharge}
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: busy ? 0.6 : 1 }}>
            {charged ? <><Check size={15} /> Charged!</> : <><CreditCard size={15} /> Charge</>}
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} disabled={busy} onClick={onCash}
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", opacity: busy ? 0.6 : 1 }}>
            <Banknote size={15} /> Cash
          </motion.button>
          <button onClick={onPrinterToggle}
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(30,127,255,0.08)", border: "1px solid rgba(30,127,255,0.15)" }}>
            <Printer size={16} style={{ color: "#1e7fff" }} />
          </button>
          <AnimatePresence>
            {showPrinter && <PrinterPopover onClose={onPrinterToggle} kitchen={kitchenPrinter} cashier={cashierPrinter} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

type PendingBill = { id: string; table_id?: string; table_name: string; items: number; total: number; since: string };

export function POS() {
  const [menu, setMenu] = useState<ApiMenuItem[]>([]);
  const [categories, setCategories] = useState<ApiMenuCategory[]>([]);
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [pending, setPending] = useState<PendingBill[]>([]);

  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [payState, setPayState] = useState<PaymentState>("open");
  const [isParcel, setIsParcel] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [showPrinter, setShowPrinter] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [charged, setCharged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const { posTableId, clearPosTable } = useAppNav();

  // ── Initial load: menu, categories, tables, restaurant settings ────────────
  useEffect(() => {
    Promise.all([menuApi.list(), menuCategoriesApi.list(), tablesApi.list(), restaurantApi.me()])
      .then(([m, cats, t, r]) => {
        setMenu(m);
        setCategories(cats);
        setActiveCat("all");
        setTables(t);
        setRestaurant(r);
      })
      .catch(() => { /* render empty on failure */ });
  }, []);

  // ── Pending table bills (kitchen-sent orders) — polled like the cashier panel ─
  const refreshPending = useCallback(async () => {
    try {
      const [rows, tableRows] = await Promise.all([ordersApi.list({ status: "sent" }), tablesApi.list()]);
      setTables(tableRows);
      const enriched: PendingBill[] = await Promise.all(rows.map(async (o) => {
        let items = 0, total = 0;
        try {
          const full = await ordersApi.get(o.id);
          for (const it of full.items ?? []) { items += it.qty; total += (it.price ?? 0) * it.qty; }
        } catch { /* leave zeros */ }
        return { id: o.id, table_id: o.table_id, table_name: o.table_name || "No table", items, total, since: relSince(o.created_at) };
      }));
      setPending(enriched);
    } catch {
      setPending([]);
    }
  }, []);

  useEffect(() => {
    void refreshPending();
    const t = window.setInterval(() => void refreshPending(), 5000);
    const onSent = () => { void refreshPending(); };
    window.addEventListener("CAFYZ_ORDER_SENT", onSent as EventListener);
    return () => { window.clearInterval(t); window.removeEventListener("CAFYZ_ORDER_SENT", onSent as EventListener); };
  }, [refreshPending]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const cur = getCurrencySymbol(restaurant?.currency_code);
  const catTabs = [{ id: "all", label: "All" }, ...categories.map(c => ({ id: c.slug, label: c.label }))];
  const filtered = menu
    .filter(m => activeCat === "all" || m.category === activeCat)
    .filter(m => !search.trim() ||
      m.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (m.description ?? "").toLowerCase().includes(search.trim().toLowerCase()));

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const serviceRate = Math.max(0, Number(restaurant?.service_charge_pct ?? 18));
  const taxRate = Math.max(0, Number(restaurant?.tax_rate_pct ?? 8.75));
  const taxLabel = (restaurant?.tax_type || "Tax").trim() || "Tax";
  const taxIncluded = restaurant?.tax_included === 1 || restaurant?.tax_included === true;
  const service = subtotal * (serviceRate / 100);
  const taxableAmount = subtotal + service;
  const tax = taxIncluded && taxRate > 0
    ? taxableAmount - taxableAmount / (1 + taxRate / 100)
    : taxableAmount * (taxRate / 100);
  const grandTotal = taxIncluded ? taxableAmount : taxableAmount + tax;

  const isPaid = payState === "card" || payState === "cash" || payState === "comped";
  const canEditBill = payState === "sent" && !!activeOrderId && !isPaid;
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);

  // ── Reset the working bill ──────────────────────────────────────────────────
  function resetBill() {
    setCart([]);
    setActiveOrderId(null);
    setPayState("open");
    setIsParcel(false);
    setEditMode(false);
  }

  // ── Table selection: load that table's pending kitchen-sent bill (self-heals
  //    a stale 'sent' order lingering on a cleared table) ──────────────────────
  async function handleTableChange(tableId: string, opts?: { skipHeal?: boolean }) {
    setSelectedTable(tableId);
    setActiveOrderId(null);
    setPayState("open");
    setEditMode(false);
    setIsParcel(false);
    if (!tableId) { setCart([]); return; }
    try {
      const orders = await ordersApi.list({ table_id: tableId });
      const sent = orders.find(o => o.status === "sent");
      const tableStatus = tables.find(t => t.id === tableId)?.status;
      // Self-heal a stale 'sent' order lingering on a cleared table — but never
      // when we just placed the order (skipHeal), and never when the local table
      // snapshot is unknown (avoid settling a fresh order on a stale 'empty').
      if (sent && tableStatus === "empty" && !opts?.skipHeal) {
        try { await ordersApi.settleTable(tableId); } catch { /* best effort */ }
        setCart([]);
        return;
      }
      if (!sent) { setCart([]); return; } // fresh table → build a new order
      const full = await ordersApi.get(sent.id);
      const nextCart: CartItem[] = (full.items ?? []).map(it => ({
        id: it.menu_item_id,
        name: it.name ?? "Item",
        price: Number(it.price ?? 0),
        qty: it.qty,
        emoji: menu.find(m => m.id === it.menu_item_id)?.symbol ?? "○",
        orderItemId: it.id,
      }));
      setCart(nextCart);
      setActiveOrderId(full.id);
      setIsParcel(full.order_type === "parcel");
      setPayState("sent");
    } catch (e) {
      toast.error("Couldn't load bill", (e as Error).message);
    }
  }

  // ── Table Map "Take Order": when arriving with a pre-chosen table, select it ─
  useEffect(() => {
    if (!posTableId) return;
    void handleTableChange(posTableId);
    clearPosTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posTableId]);

  // ── Add a menu item: persists to a live bill, else builds the local cart ─────
  async function addProduct(item: ApiMenuItem) {
    if (!activeOrderId || busy) return;
    const idx = cart.findIndex(c => c.id === item.id && c.orderItemId);
    if (idx >= 0) { await updateQty(cart[idx].id, 1); return; }
    setBusy(true);
    try {
      const created = await ordersApi.addItem(activeOrderId, { menu_item_id: item.id, qty: 1, mods: [] });
      setCart(cs => [...cs, { id: item.id, name: item.name, price: item.price, qty: 1, emoji: item.symbol, orderItemId: created.id, addedNow: true }]);
    } catch (e) {
      toast.error("Couldn't add item", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addLocal(item: ApiMenuItem) {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id && !c.orderItemId);
      if (ex) return prev.map(c => (c === ex ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, emoji: item.symbol }];
    });
  }

  const addToCart = (item: ApiMenuItem) => { if (canEditBill) void addProduct(item); else addLocal(item); };

  // ── Quantity / removal: persist when the line is backed by an order item ─────
  async function updateQty(id: string, delta: number) {
    const idx = cart.findIndex(c => c.id === id);
    if (idx < 0) return;
    const item = cart[idx];
    if (item.orderItemId && activeOrderId) {
      const newQty = item.qty + delta;
      if (newQty < 1) {
        const prev = cart;
        setCart(cs => cs.filter((_, i) => i !== idx));
        try { await ordersApi.deleteItem(activeOrderId, item.orderItemId); }
        catch (e) { setCart(prev); toast.error("Remove failed", (e as Error).message); }
        return;
      }
      const prev = cart;
      setCart(cs => cs.map((c, i) => (i === idx ? { ...c, qty: newQty } : c)));
      try { await ordersApi.updateItem(activeOrderId, item.orderItemId, { qty: newQty }); }
      catch (e) { setCart(prev); toast.error("Update failed", (e as Error).message); }
    } else {
      setCart(cs => cs.map(c => (c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c)).filter(c => c.qty > 0));
    }
  }

  // ── Parcel: persists on a live bill, otherwise a local flag for the new order ─
  async function toggleParcel() {
    if (canEditBill && activeOrderId) {
      const next = !isParcel;
      setIsParcel(next);
      try { await ordersApi.update(activeOrderId, { order_type: next ? "parcel" : "dine_in" }); }
      catch (e) { setIsParcel(!next); toast.error("Couldn't update parcel", (e as Error).message); }
    } else {
      setIsParcel(p => !p);
    }
  }

  // ── Charge: settle an existing bill, or create+send+settle a fresh walk-in ───
  async function handleCharge(method: "card" | "cash") {
    if (!cart.length) { toast.error("Cart is empty", `Add items before ${method === "card" ? "charging" : "payment"}`); return; }
    if (!selectedTable) { toast.error("No table selected", "Pick a table for this bill"); return; }
    setBusy(true);
    try {
      if (canEditBill && activeOrderId) {
        // Existing kitchen-sent bill → settle the whole table atomically.
        await ordersApi.settleTable(selectedTable);
      } else {
        // Fresh cart → fire to kitchen (with print) then settle as a paid sale.
        await ordersApi.quickSend({
          table_id: selectedTable,
          parcel: isParcel,
          enqueue_print: true,
          items: cart.map(c => ({ menu_item_id: c.id, qty: c.qty, mods: [] })),
        });
        await ordersApi.settleTable(selectedTable);
      }
      if (method === "card") setCharged(true);
      const tName = tables.find(t => t.id === selectedTable)?.name ?? "";
      toast.success(
        `${cur}${grandTotal.toFixed(0)} ${method === "card" ? "charged" : "received"} · ${tName}`,
        `${itemCount} item${itemCount !== 1 ? "s" : ""} · ${method === "card" ? "Card" : "Cash"} payment`,
      );
      window.dispatchEvent(new Event("CAFYZ_ORDER_SENT"));
      setTimeout(() => { setCharged(false); resetBill(); setShowMobileCart(false); }, method === "card" ? 1600 : 1100);
      await refreshPending();
    } catch (e) {
      toast.error("Payment failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── Send to Kitchen: place a fresh dine-in order for this table (no payment).
  //    The table becomes occupied with a pending bill you can charge later. ─────
  async function sendToKitchen() {
    if (!cart.length) { toast.error("Cart is empty", "Add items before sending"); return; }
    if (!selectedTable) { toast.error("No table selected", "Pick a table for this order"); return; }
    setBusy(true);
    try {
      await ordersApi.quickSend({
        table_id: selectedTable,
        parcel: isParcel,
        enqueue_print: true,
        items: cart.map(c => ({ menu_item_id: c.id, qty: c.qty, mods: [] })),
      });
      const tName = tables.find(t => t.id === selectedTable)?.name ?? "";
      toast.success(`Order sent to kitchen · ${tName}`, `${itemCount} item${itemCount !== 1 ? "s" : ""} placed for the table`);
      window.dispatchEvent(new Event("CAFYZ_ORDER_SENT"));
      await refreshPending();
      await handleTableChange(selectedTable, { skipHeal: true }); // reload the just-placed bill
    } catch (e) {
      toast.error("Couldn't send order", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const kitchenPrinterName = restaurant?.kitchen_printer?.name ?? null;
  const cashierPrinterName = restaurant?.cashier_printer?.name ?? null;

  // A fresh (not-yet-sent) cart on a chosen table can be sent to the kitchen.
  const sendable = !canEditBill && cart.length > 0 && !!selectedTable;

  const cartProps = {
    cart, selectedTable, tables, isParcel, editMode, breakdownOpen, showPrinter, charged, busy,
    cur, subtotal, service, tax, grandTotal, serviceRate, taxRate, taxLabel,
    kitchenPrinter: kitchenPrinterName, cashierPrinter: cashierPrinterName,
    sendable,
    onSend: () => void sendToKitchen(),
    onTableChange: handleTableChange,
    onParcelToggle: () => void toggleParcel(),
    onEditToggle: () => setEditMode(e => !e),
    onBreakdownToggle: () => setBreakdownOpen(o => !o),
    onPrinterToggle: () => setShowPrinter(p => !p),
    onUpdateQty: (id: string, d: number) => void updateQty(id, d),
    onClear: resetBill,
    onCharge: () => void handleCharge("card"),
    onCash: () => void handleCharge("cash"),
  };

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* ── Left: menu panel ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Pending bills strip */}
        <div className="flex gap-2 px-3 pt-3 pb-2 overflow-x-auto scrollbar-hide flex-shrink-0">
          {pending.length === 0 && (
            <div className="flex items-center px-3 py-2 flex-shrink-0" style={{ minHeight: 48 }}>
              <span style={{ color: "#6b82a0", fontSize: "0.73rem" }}>No pending table bills</span>
            </div>
          )}
          {pending.map(b => (
            <button key={b.id} onClick={() => { if (b.table_id) void handleTableChange(b.table_id); }}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 flex-shrink-0 transition-all"
              style={{
                background: selectedTable === b.table_id ? "rgba(30,127,255,0.12)" : "#0d1326",
                border: `1px solid ${selectedTable === b.table_id ? "rgba(30,127,255,0.35)" : "rgba(30,127,255,0.1)"}`,
                minHeight: 48,
              }}>
              <div>
                <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>{b.table_name}</p>
                <p style={{ color: "#6b82a0", fontSize: "0.67rem" }}>{b.items} item{b.items !== 1 ? "s" : ""} · {b.since}</p>
              </div>
              <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.82rem" }}>{cur}{b.total.toFixed(0)}</span>
            </button>
          ))}
          <button onClick={() => { setSelectedTable(""); resetBill(); }} className="flex items-center gap-1.5 rounded-xl px-3 py-2 flex-shrink-0"
            style={{ background: "#0d1326", border: "1px dashed rgba(30,127,255,0.2)", minHeight: 48 }}>
            <Plus size={13} style={{ color: "#6b82a0" }} />
            <span style={{ color: "#6b82a0", fontSize: "0.73rem" }}>New</span>
          </button>
        </div>

        {/* Search + categories */}
        <div className="px-3 pb-2 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}>
            <Search size={14} style={{ color: "#6b82a0" }} />
            <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-[#6b82a0]"
              style={{ color: "#e8eef8" }} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
            {catTabs.map(c => (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 font-medium transition-all"
                style={activeCat === c.id
                  ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }
                  : { background: "#0d1326", color: "#6b82a0", border: "1px solid rgba(30,127,255,0.1)" }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Menu grid */}
        <div className="flex-1 overflow-y-auto px-3 pb-24 lg:pb-4 scrollbar-hide">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {filtered.map(item => {
              const inCart = cart.find(c => c.id === item.id);
              return (
                <motion.button key={item.id} whileTap={{ scale: 0.94 }} onClick={() => addToCart(item)}
                  className="rounded-2xl p-3 text-left relative transition-all"
                  style={{
                    background: inCart ? "rgba(30,127,255,0.08)" : "#0d1326",
                    border: `1px solid ${inCart ? "rgba(30,127,255,0.25)" : "rgba(30,127,255,0.08)"}`,
                    minHeight: 100,
                  }}>
                  {item.is_popular ? (
                    <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: "0.58rem" }}>★</span>
                  ) : null}
                  <div className="text-2xl mb-1.5">{item.symbol}</div>
                  <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.3 }}>{item.name}</p>
                  <p style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.85rem", marginTop: 3 }}>{cur}{item.price}</p>
                  {inCart && (
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "#1e7fff" }}>
                      <span style={{ color: "#fff", fontSize: "0.58rem", fontWeight: 700 }}>{inCart.qty}</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full flex items-center justify-center h-32">
                <p style={{ color: "#6b82a0", fontSize: "0.8rem" }}>
                  {search ? `No results for "${search}"` : "No items in this category"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop: right sidebar cart ── */}
      <div className="hidden lg:flex w-80 xl:w-96 flex-col flex-shrink-0 border-l"
        style={{ background: "#080c1e", borderColor: "rgba(30,127,255,0.1)" }}>
        <CartPanel {...cartProps} />
      </div>

      {/* ── Mobile: floating cart button ── */}
      <AnimatePresence>
        {!showMobileCart && (
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={() => setShowMobileCart(true)}
            className="lg:hidden fixed bottom-24 right-4 z-30 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 8px 24px rgba(30,127,255,0.4)" }}
          >
            <ShoppingCart size={18} className="text-white" />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>
              {itemCount > 0 ? `${itemCount} items` : "Cart"}
            </span>
            {itemCount > 0 && (
              <span style={{ background: "#fff", color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "0.75rem" }}
                className="px-2 py-0.5 rounded-full">
                {cur}{grandTotal.toFixed(0)}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Mobile: full-screen cart sheet ── */}
      <AnimatePresence>
        {showMobileCart && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMobileCart(false)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden flex flex-col"
              style={{ background: "#080c1e", border: "1px solid rgba(30,127,255,0.15)", maxHeight: "90vh" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: "rgba(30,127,255,0.2)" }} />
              </div>
              <CartPanel {...cartProps} isMobile onClose={() => setShowMobileCart(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
