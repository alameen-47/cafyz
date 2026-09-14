import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Plus, Minus, X, Banknote, CreditCard, QrCode, Printer, ReceiptText,
  ShoppingCart, ChefHat, RotateCcw, Loader2, Star,
} from "lucide-react";
import { toast } from "./Toast";
import {
  menuApi, menuCategoriesApi, ordersApi, restaurantApi, tablesApi,
  RESTAURANT_SETTINGS_CHANGED_EVENT,
  type ApiMenuItem, type ApiMenuCategory, type ApiTable, type ApiRestaurant, type PaymentMethod,
} from "../../services/api";
import { getCurrencySymbol, getActiveCurrencyCode, applyRestaurantCurrency } from "../../utils/currency";
import { computeBillTotals } from "../../utils/billTotals";
import { getRestaurantLogo, syncRestaurantLogoCacheAsync } from "../../services/restaurantLogoStorage";
import { print, type ReceiptData } from "../../services/PrintService";
import { useAppNav } from "../nav";
import { useAuth } from "../auth";
import { PrinterStatusBadge } from "./PrinterStatusBadge";
import { demoMenuImage } from "../../utils/demoMenuImages";

// ── Model ─────────────────────────────────────────────────────────────────────
// A bill is a list of lines. Lines with an `orderItemId` are already saved on a
// table's open order; lines without one are new and live only on this screen
// until the bill is paid (or, for a table, sent to the kitchen).

interface CartLine {
  id: string;            // menu item id
  name: string;
  price: number;
  qty: number;
  emoji: string;
  orderId?: string;
  orderItemId?: string;
}

type PendingBill = { table_id: string; table_name: string; items: number; subtotal: number; createdAt: string };
type Busy = null | "pay" | "send" | "load";
type Totals = ReturnType<typeof computeBillTotals>;

const PAY_OPTIONS: { method: PaymentMethod; label: string; Icon: typeof Banknote; style: React.CSSProperties }[] = [
  { method: "cash", label: "Cash", Icon: Banknote, style: { background: "linear-gradient(135deg, #15803d, #22c55e)", color: "#fff" } },
  { method: "upi", label: "UPI", Icon: QrCode, style: { background: "linear-gradient(135deg, #1565e0, #00b4ff)", color: "#fff" } },
  { method: "card", label: "Card", Icon: CreditCard, style: { background: "linear-gradient(135deg, #4338ca, #7c3aed)", color: "#fff" } },
];
const PAY_LABEL: Record<PaymentMethod, string> = { cash: "Cash", upi: "UPI", card: "Card" };

const lineKey = (l: CartLine) => l.orderItemId ?? `new:${l.id}`;

/** Menu symbols default to a plain "○"; only show real emoji. */
const visibleSymbol = (symbol?: string | null) => (symbol && symbol.trim() !== "○" ? symbol : "");

function formatMoney(cur: string, amount: number) {
  const rounded = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  return `${cur}${rounded}`;
}

function relSince(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ── Menu grid (memoised: a cart change only re-renders the tiles whose count changed) ─
const MenuGrid = memo(function MenuGrid({
  items, qtyById, cur, onAdd, emptyText,
}: {
  items: ApiMenuItem[];
  qtyById: Map<string, number>;
  cur: string;
  onAdd: (item: ApiMenuItem) => void;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {items.map(item => {
        const qty = qtyById.get(item.id) ?? 0;
        const photo = item.image_url || demoMenuImage(item);
        const symbol = visibleSymbol(item.symbol);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onAdd(item)}
            className={`rounded-2xl ${photo ? "p-2" : "p-3"} text-start relative select-none touch-manipulation transition-transform duration-100 active:scale-[0.96]`}
            style={{
              background: qty ? "rgba(30,127,255,0.08)" : "var(--cafyz-surface)",
              border: `1px solid ${qty ? "rgba(30,127,255,0.38)" : "var(--cafyz-border)"}`,
              minHeight: 96,
            }}
          >
            {qty > 0 && (
              <span
                className="absolute z-[1] top-2 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center"
                style={{ background: "#1e7fff", color: "#fff", fontSize: "0.72rem", fontWeight: 700 }}
              >
                {qty}
              </span>
            )}
            {photo ? (
              <img src={photo} alt="" loading="lazy" decoding="async" draggable={false}
                className="w-full aspect-[4/3] object-cover rounded-xl mb-2"
                style={{ background: "var(--cafyz-subtle-bg)" }} />
            ) : symbol ? (
              <div className="text-2xl mb-1.5" aria-hidden>{symbol}</div>
            ) : null}
            <p className={photo ? "px-1" : ""} style={{ color: "var(--cafyz-text)", fontSize: "0.8rem", fontWeight: 600, lineHeight: 1.3 }}>{item.name}</p>
            <p className={`flex items-center gap-1${photo ? " px-1" : ""}`} style={{ color: "var(--cafyz-brand)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.86rem", marginTop: 3 }}>
              {formatMoney(cur, item.price)}
              {item.is_popular ? <Star size={11} fill="#f59e0b" stroke="#f59e0b" aria-label="Popular" /> : null}
            </p>
          </button>
        );
      })}
    </div>
  );
});

// ── Bill panel (desktop sidebar and mobile sheet) ─────────────────────────────
function BillPanel({
  cart, tables, tableId, liveBill, isParcel, busy, ready, cur, subtotal, totals, taxLabel,
  kitchenPrinter, cashierPrinter, hasLastBill,
  onTableChange, onParcelChange, onQty, onPay, onSend, onPrintBill, onReprint, onClear, onClose, isMobile,
}: {
  cart: CartLine[]; tables: ApiTable[]; tableId: string; liveBill: boolean; isParcel: boolean;
  busy: Busy; ready: boolean; cur: string; subtotal: number; totals: Totals; taxLabel: string;
  kitchenPrinter?: string | null; cashierPrinter?: string | null; hasLastBill: boolean;
  onTableChange: (id: string) => void; onParcelChange: (parcel: boolean) => void;
  onQty: (key: string, delta: number) => void; onPay: (method: PaymentMethod) => void;
  onSend: () => void; onPrintBill: () => void; onReprint: () => void; onClear: () => void;
  onClose?: () => void; isMobile?: boolean;
}) {
  const tableName = tables.find(t => t.id === tableId)?.name ?? "";
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);
  const newLines = cart.filter(c => !c.orderItemId);
  const canPay = ready && cart.length > 0 && !busy;
  const canSend = !!tableId && newLines.length > 0 && !busy;
  const step = isMobile ? "w-9 h-9" : "w-8 h-8";

  const subtitle = liveBill
    ? "Open bill — add items or take payment"
    : tableId ? "New order for this table" : "No table needed — just add items";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header: who the bill is for */}
      <div className="flex-shrink-0 px-3 sm:px-4 pt-3 pb-3 space-y-2.5 border-b" style={{ borderColor: "var(--cafyz-border)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate" style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: isMobile ? "1.05rem" : "0.98rem" }}>
              {tableName || (isParcel ? "Takeaway" : "Counter sale")}
            </h3>
            <p style={{ color: liveBill ? "#16a34a" : "var(--cafyz-muted)", fontSize: "0.72rem", marginTop: 2, fontWeight: liveBill ? 600 : 400 }}>
              {busy === "load" ? "Loading table bill…" : subtitle}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hasLastBill && (
              <button type="button" onClick={onReprint} title="Print the last paid bill again"
                className="flex items-center gap-1 px-2.5 rounded-lg text-xs font-semibold min-h-[36px]"
                style={{ background: "var(--cafyz-accent-soft)", color: "var(--cafyz-brand)" }}>
                <RotateCcw size={13} /> Reprint
              </button>
            )}
            {isMobile && onClose && (
              <button type="button" onClick={onClose} aria-label="Close bill"
                className="rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{ background: "var(--cafyz-accent-soft)", color: "var(--cafyz-muted)" }}>
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
          <div className="flex rounded-xl p-0.5" role="group" aria-label="Order type"
            style={{ background: "var(--cafyz-subtle-bg)", border: "1px solid var(--cafyz-border)" }}>
            {([false, true] as const).map(parcel => (
              <button key={String(parcel)} type="button" onClick={() => onParcelChange(parcel)} aria-pressed={isParcel === parcel}
                className="px-3 rounded-[10px] text-xs font-semibold min-h-[38px] transition-colors"
                style={isParcel === parcel
                  ? { background: "var(--cafyz-surface)", color: "var(--cafyz-brand)", boxShadow: "var(--cafyz-shadow-sm)" }
                  : { color: "var(--cafyz-muted)" }}>
                {parcel ? "Takeaway" : "Dine-in"}
              </button>
            ))}
          </div>
          <select value={tableId} onChange={e => onTableChange(e.target.value)} disabled={busy === "pay"} aria-label="Table (optional)"
            className="w-full min-w-0 rounded-xl px-3 text-sm outline-none min-h-[40px]"
            style={{ background: "var(--cafyz-input-bg)", color: "var(--cafyz-text)", border: "1px solid var(--cafyz-border-strong)" }}>
            <option value="">No table (counter)</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.status && t.status !== "empty" ? " • open" : ""}</option>
            ))}
          </select>
        </div>

        {(kitchenPrinter || cashierPrinter) && <PrinterStatusBadge kitchen={kitchenPrinter} cashier={cashierPrinter} />}
      </div>

      {/* Lines */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 py-2 scrollbar-hide">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3 rounded-xl mt-2"
            style={{ border: "1px dashed var(--cafyz-border-strong)" }}>
            <ReceiptText size={28} style={{ color: "var(--cafyz-muted)" }} />
            <div>
              <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.86rem", fontWeight: 600 }}>Tap menu items to start a bill</p>
              <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem", marginTop: 4, lineHeight: 1.5 }}>
                Then tap Cash, UPI or Card — the bill is saved and printed in one go.
              </p>
            </div>
          </div>
        ) : (
          <ul>
            {cart.map(line => (
              <li key={lineKey(line)} className="flex items-center gap-2 py-2.5 border-b" style={{ borderColor: "var(--cafyz-border)" }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ color: "var(--cafyz-text)", fontSize: "0.83rem", fontWeight: 600, lineHeight: 1.3 }}>
                    {line.emoji && <span className="me-1.5" aria-hidden>{line.emoji}</span>}{line.name}
                  </p>
                  <p className="flex items-center gap-1.5" style={{ color: "var(--cafyz-muted)", fontSize: "0.7rem", marginTop: 2 }}>
                    {formatMoney(cur, line.price)} each
                    {liveBill && !line.orderItemId && (
                      <span className="px-1.5 rounded" style={{ background: "var(--cafyz-warning-bg)", color: "var(--cafyz-warning)", fontWeight: 700 }}>new</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => onQty(lineKey(line), -1)} disabled={busy === "pay"} aria-label={`One less ${line.name}`}
                    className={`${step} rounded-lg flex items-center justify-center touch-manipulation`}
                    style={{ background: "var(--cafyz-danger-bg)", color: "var(--cafyz-danger)" }}>
                    <Minus size={14} />
                  </button>
                  <span className="w-7 text-center" style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.88rem" }}>{line.qty}</span>
                  <button type="button" onClick={() => onQty(lineKey(line), 1)} disabled={busy === "pay"} aria-label={`One more ${line.name}`}
                    className={`${step} rounded-lg flex items-center justify-center touch-manipulation`}
                    style={{ background: "var(--cafyz-accent-bg)", color: "var(--cafyz-brand)" }}>
                    <Plus size={14} />
                  </button>
                </div>
                <span className="w-16 text-end flex-shrink-0" style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.84rem" }}>
                  {formatMoney(cur, line.price * line.qty)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals + actions */}
      <div className="flex-shrink-0 px-3 sm:px-4 pt-3 pb-3 space-y-2.5 border-t safe-area-pb"
        style={{ borderColor: "var(--cafyz-border)", background: "var(--cafyz-surface-2)" }}>
        {(totals.service > 0 || totals.tax > 0) && (
          <div className="space-y-1" style={{ fontSize: "0.74rem" }}>
            <div className="flex justify-between" style={{ color: "var(--cafyz-text-secondary)" }}>
              <span>Subtotal · {itemCount} item{itemCount !== 1 ? "s" : ""}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{formatMoney(cur, subtotal)}</span>
            </div>
            {totals.service > 0 && (
              <div className="flex justify-between" style={{ color: "var(--cafyz-muted)" }}>
                <span>Service ({totals.serviceRate}%)</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{formatMoney(cur, totals.service)}</span>
              </div>
            )}
            {totals.tax > 0 && (
              <div className="flex justify-between" style={{ color: "var(--cafyz-muted)" }}>
                <span>{taxLabel} ({totals.taxRate}%){totals.taxIncluded ? " incl." : ""}</span>
                <span style={{ fontFamily: "var(--font-mono)" }}>{formatMoney(cur, totals.tax)}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
          style={{ background: "var(--cafyz-accent-bg)", border: "1px solid var(--cafyz-accent-border)" }}>
          <span style={{ color: "var(--cafyz-text)", fontWeight: 700, fontSize: "0.9rem" }}>Total</span>
          <span style={{ color: "var(--cafyz-text-strong)", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: isMobile ? "1.5rem" : "1.35rem" }}>
            {formatMoney(cur, totals.grandTotal)}
          </span>
        </div>

        {canSend && (
          <button type="button" onClick={onSend}
            className="w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-2 min-h-[46px] touch-manipulation active:scale-[0.98] transition-transform"
            style={{ background: "rgba(245,158,11,0.12)", color: "#c2410c", border: "1px solid rgba(245,158,11,0.4)" }}>
            <ChefHat size={16} /> Send {newLines.length === cart.length ? "" : "new items "}to kitchen · pay later
          </button>
        )}

        <div className="grid grid-cols-3 gap-2">
          {PAY_OPTIONS.map(({ method, label, Icon, style }) => (
            <button key={method} type="button" onClick={() => onPay(method)} disabled={!canPay}
              className="rounded-xl flex flex-col items-center justify-center gap-0.5 min-h-[58px] text-sm font-bold touch-manipulation active:scale-[0.97] transition-transform disabled:opacity-40"
              style={style}>
              {busy === "pay" ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p className="text-center" style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem" }}>
          Tap how the customer paid — the bill is saved and printed.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onPrintBill} disabled={cart.length === 0 || !ready}
            className="flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold min-h-[40px] disabled:opacity-40"
            style={{ background: "var(--cafyz-accent-soft)", color: "var(--cafyz-text-secondary)", border: "1px solid var(--cafyz-border)" }}>
            <Printer size={14} /> Print bill (unpaid)
          </button>
          <button type="button" onClick={onClear} disabled={(cart.length === 0 && !tableId) || busy === "pay"}
            className="rounded-lg text-xs font-semibold min-h-[40px] disabled:opacity-40"
            style={{ background: "var(--cafyz-danger-bg)", color: "var(--cafyz-danger)" }}>
            {liveBill ? "Close table bill" : "Clear bill"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── POS screen ────────────────────────────────────────────────────────────────
export function POS() {
  const { user } = useAuth();
  const { posTableId, clearPosTable } = useAppNav();

  const [menu, setMenu] = useState<ApiMenuItem[]>([]);
  const [categories, setCategories] = useState<ApiMenuCategory[]>([]);
  const [tables, setTables] = useState<ApiTable[]>([]);
  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<PendingBill[]>([]);

  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tableId, setTableId] = useState("");
  const [liveBill, setLiveBill] = useState(false);
  const [isParcel, setIsParcel] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [lastBill, setLastBill] = useState<ReceiptData | null>(null);
  const busyRef = useRef(false);   // guards double taps before React re-renders
  const loadSeq = useRef(0);       // ignores a slow table load after switching away
  const printerHintShown = useRef(false);

  // ── Initial load (each request independent, so one failure doesn't blank the screen)
  useEffect(() => {
    void Promise.allSettled([menuApi.list(), menuCategoriesApi.list(), tablesApi.list(), restaurantApi.me()])
      .then(([m, cats, t, r]) => {
        if (m.status === "fulfilled") setMenu(m.value);
        if (cats.status === "fulfilled") setCategories(cats.value);
        if (t.status === "fulfilled") setTables(t.value);
        if (r.status === "fulfilled") {
          setRestaurant(r.value);
          applyRestaurantCurrency(r.value);
          void syncRestaurantLogoCacheAsync(r.value);
        }
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    const refreshRestaurant = () => {
      void restaurantApi.me().then(r => {
        setRestaurant(r);
        applyRestaurantCurrency(r);
        void syncRestaurantLogoCacheAsync(r);
      }).catch(() => {});
    };
    window.addEventListener(RESTAURANT_SETTINGS_CHANGED_EVENT, refreshRestaurant);
    return () => window.removeEventListener(RESTAURANT_SETTINGS_CHANGED_EVENT, refreshRestaurant);
  }, []);

  // ── Open table bills (sent to kitchen, not yet paid). Polls only while visible.
  const refreshPending = useCallback(async () => {
    try {
      const rows = await ordersApi.live({ active: true });
      const byTable = new Map<string, PendingBill>();
      for (const o of rows) {
        if (o.status !== "sent" || !o.table_id) continue;
        const items = (o.items ?? []).reduce((s, it) => s + it.qty, 0);
        const subtotal = o.subtotal ?? (o.items ?? []).reduce((s, it) => s + Number(it.price ?? 0) * it.qty, 0);
        const existing = byTable.get(o.table_id);
        if (existing) {
          existing.items += items;
          existing.subtotal += subtotal;
          if (o.created_at < existing.createdAt) existing.createdAt = o.created_at;
        } else {
          byTable.set(o.table_id, { table_id: o.table_id, table_name: o.table_name || "Table", items, subtotal, createdAt: o.created_at });
        }
      }
      setPending(Array.from(byTable.values()));
    } catch {
      /* keep the last list through a network blip */
    }
  }, []);

  useEffect(() => {
    void refreshPending();
    const tick = () => { if (document.visibilityState === "visible") void refreshPending(); };
    const id = window.setInterval(tick, 8000);
    const onSent = () => { void refreshPending(); };
    window.addEventListener("CAFYZ_ORDER_SENT", onSent);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("CAFYZ_ORDER_SENT", onSent);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refreshPending]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const cur = getCurrencySymbol(restaurant?.currency_code, restaurant?.currency_symbol);
  const taxLabel = (restaurant?.tax_type || "Tax").trim() || "Tax";
  const totalsFor = useCallback((subtotal: number) => computeBillTotals({
    subtotal,
    serviceRatePct: restaurant?.service_charge_pct ?? 18,
    taxRatePct: restaurant?.tax_rate_pct ?? 8.75,
    taxIncluded: restaurant?.tax_included,
  }), [restaurant]);

  const catTabs = useMemo(() => [{ id: "all", label: "All" }, ...categories.map(c => ({ id: c.slug, label: c.label }))], [categories]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menu.filter(m => (activeCat === "all" || m.category === activeCat)
      && (!q || m.name.toLowerCase().includes(q) || (m.description ?? "").toLowerCase().includes(q)));
  }, [menu, activeCat, search]);
  const qtyById = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of cart) map.set(l.id, (map.get(l.id) ?? 0) + l.qty);
    return map;
  }, [cart]);

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const totals = totalsFor(subtotal);
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);
  const selectedTable = tables.find(t => t.id === tableId);

  // ── Cart edits (local lines are instant; saved lines sync in the background) ──
  const addItem = useCallback((item: ApiMenuItem) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.id === item.id && !c.orderItemId);
      if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, emoji: visibleSymbol(item.symbol) }];
    });
  }, []);

  async function changeQty(key: string, delta: number) {
    const line = cart.find(l => lineKey(l) === key);
    if (!line) return;
    const nextQty = line.qty + delta;
    const apply = (lines: CartLine[]) => lines.flatMap(l => (lineKey(l) !== key ? [l] : nextQty > 0 ? [{ ...l, qty: nextQty }] : []));
    if (!line.orderItemId || !line.orderId) { setCart(apply); return; }
    const before = cart;
    setCart(apply);
    try {
      if (nextQty < 1) await ordersApi.deleteItem(line.orderId, line.orderItemId);
      else await ordersApi.updateItem(line.orderId, line.orderItemId, { qty: nextQty });
      void refreshPending();
    } catch {
      setCart(before);
    }
  }

  function resetBill() {
    loadSeq.current++;
    setCart([]);
    setTableId("");
    setLiveBill(false);
    setIsParcel(false);
  }

  // ── Tables are optional. Picking one loads its open bill; new lines carry over.
  async function loadTableBill(id: string, carry: CartLine[], opts?: { skipHeal?: boolean }) {
    const seq = ++loadSeq.current;
    setBusy("load");
    try {
      const [sent, tableRows] = await Promise.all([ordersApi.list({ table_id: id, status: "sent" }), tablesApi.list()]);
      if (seq !== loadSeq.current) return;
      setTables(tableRows);
      let open = sent;
      // Self-heal: a 'sent' order lingering on a table that was already cleared.
      if (open.length && tableRows.find(t => t.id === id)?.status === "empty" && !opts?.skipHeal) {
        try { await ordersApi.settleTable(id); } catch { /* best effort */ }
        open = [];
      }
      const full = await Promise.all(open.map(o => ordersApi.get(o.id)));
      if (seq !== loadSeq.current) return;
      const symbolOf = (menuId: string) => visibleSymbol(menu.find(m => m.id === menuId)?.symbol);
      const saved: CartLine[] = full.flatMap(o => (o.items ?? []).map(it => ({
        id: it.menu_item_id,
        name: it.name ?? "Item",
        price: Number(it.price ?? 0),
        qty: it.qty,
        emoji: symbolOf(it.menu_item_id),
        orderId: o.id,
        orderItemId: it.id,
      })));
      setCart([...saved, ...carry]);
      setLiveBill(full.length > 0);
      if (full.length) setIsParcel(full[0].order_type === "parcel");
    } catch {
      if (seq === loadSeq.current) setCart(carry);
    } finally {
      if (seq === loadSeq.current) setBusy(b => (b === "load" ? null : b));
    }
  }

  function selectTable(next: string) {
    if (next === tableId) return;
    const carry = cart.filter(c => !c.orderItemId);
    setTableId(next);
    setLiveBill(false);
    setCart(carry);
    if (!next) {
      loadSeq.current++;
      setBusy(b => (b === "load" ? null : b));
      return;
    }
    void loadTableBill(next, carry);
  }

  async function changeParcel(parcel: boolean) {
    setIsParcel(parcel);
    if (!liveBill) return;
    const orderIds = Array.from(new Set(cart.map(c => c.orderId).filter((x): x is string => !!x)));
    await Promise.allSettled(orderIds.map(id => ordersApi.update(id, { order_type: parcel ? "parcel" : "dine_in" })));
  }

  // Arriving from the Table map's "Take order".
  useEffect(() => {
    if (!posTableId) return;
    selectTable(posTableId);
    setShowMobileCart(true);
    clearPosTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posTableId]);

  // ── Receipts ─────────────────────────────────────────────────────────────────
  function receiptFor(lines: CartLine[], o: { payMethod?: string; billNo?: number | null; table?: ApiTable; parcel: boolean }): ReceiptData {
    const merged = new Map<string, { name: string; qty: number; price: number }>();
    for (const l of lines) {
      const k = `${l.id}|${l.price}`;
      const m = merged.get(k);
      if (m) m.qty += l.qty;
      else merged.set(k, { name: l.name, qty: l.qty, price: l.price });
    }
    const sub = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const t = totalsFor(sub);
    const code = restaurant?.currency_code ?? getActiveCurrencyCode();
    const address = [restaurant?.address_line1, restaurant?.address_line2, restaurant?.city, restaurant?.postal_code, restaurant?.country]
      .filter(Boolean).join(", ");
    return {
      restaurantName: restaurant?.name || user?.restaurant_name || "Restaurant",
      currencySymbol: getCurrencySymbol(code, restaurant?.currency_symbol),
      currencyCode: code,
      logoUrl: getRestaurantLogo(user?.restaurant_id ?? restaurant?.id, restaurant?.logo_url),
      addressLine: address || undefined,
      phone: restaurant?.contact_phone || undefined,
      taxId: restaurant?.tax_id || undefined,
      billNo: o.billNo ?? undefined,
      orderLabel: o.parcel ? "Takeaway" : o.table ? undefined : "Counter sale",
      tableName: o.table?.name ?? "",
      serverName: user?.name,
      covers: o.table?.covers || undefined,
      items: Array.from(merged.values()),
      subtotal: sub,
      service: t.service,
      tax: t.tax,
      total: t.grandTotal,
      serviceRate: t.serviceRate,
      taxRate: t.taxRate,
      taxLabel,
      taxIncluded: t.taxIncluded,
      payMethod: o.payMethod,
      footer: restaurant?.receipt_footer || undefined,
    };
  }

  async function printReceipt(receipt: ReceiptData) {
    try {
      const channel = restaurant?.cashier_printer?.channel;
      const method = await print(receipt, undefined, 32, user?.restaurant_id ?? restaurant?.id, channel ? { channel } : undefined);
      if (method === "dialog") toast.success("Bill ready", "Finish printing in the print dialog.");
    } catch (e) {
      const message = (e as Error).message;
      // No printer set up yet (e.g. the phone app before Printer setup): the bill is still saved,
      // so explain once per session rather than after every sale.
      if (/printer/i.test(message)) {
        if (printerHintShown.current) return;
        printerHintShown.current = true;
      }
      toast.error("Bill saved — not printed", message);
    }
  }

  // ── Pay: one tap saves the bill and prints it ────────────────────────────────
  async function pay(method: PaymentMethod) {
    if (busyRef.current || cart.length === 0 || !loaded) return;
    busyRef.current = true;
    setBusy("pay");
    const lines = cart;
    const newItems = lines.filter(c => !c.orderItemId).map(c => ({ menu_item_id: c.id, qty: c.qty, mods: [] as string[] }));
    const table = selectedTable;
    const parcel = isParcel;
    const payingTableId = tableId;
    let sentToTable = false;
    try {
      let billNo: number | null;
      if (!liveBill) {
        // Counter sale or a fresh table: one request.
        const res = await ordersApi.instantBill({ table_id: payingTableId || null, parcel, payment_method: method, items: newItems });
        billNo = res.bill_no;
      } else {
        if (newItems.length) {
          await ordersApi.quickSend({ table_id: payingTableId, parcel, enqueue_print: true, items: newItems });
          sentToTable = true;
        }
        billNo = (await ordersApi.settleTable(payingTableId, method)).bill_no;
      }

      const receipt = receiptFor(lines, { payMethod: PAY_LABEL[method], billNo, table, parcel });
      setLastBill(receipt);
      resetBill();
      setShowMobileCart(false);
      toast.success(
        `${billNo ? `Bill ${billNo} · ` : ""}${formatMoney(cur, receipt.total)} paid by ${PAY_LABEL[method]}`,
        table?.name ?? (parcel ? "Takeaway" : "Counter sale"),
      );
      void printReceipt(receipt);
      window.dispatchEvent(new Event("CAFYZ_ORDER_SENT"));
      window.dispatchEvent(new Event("CAFYZ_NOTIFICATIONS_REFRESH"));
    } catch {
      // The API client already showed the reason. Re-sync a table so a retry can't double-send.
      if (payingTableId && (sentToTable || !liveBill)) void loadTableBill(payingTableId, sentToTable ? [] : lines, { skipHeal: true });
    } finally {
      busyRef.current = false;
      setBusy(b => (b === "pay" ? null : b));
    }
  }

  // ── Table service: send new lines to the kitchen now, pay later ──────────────
  async function sendToKitchen() {
    const newLines = cart.filter(c => !c.orderItemId);
    if (busyRef.current || !tableId || newLines.length === 0) return;
    busyRef.current = true;
    setBusy("send");
    try {
      await ordersApi.quickSend({
        table_id: tableId,
        parcel: isParcel,
        enqueue_print: true,
        items: newLines.map(c => ({ menu_item_id: c.id, qty: c.qty, mods: [] })),
      });
      const count = newLines.reduce((s, c) => s + c.qty, 0);
      toast.success(`Sent to kitchen · ${selectedTable?.name ?? "Table"}`, `${count} item${count !== 1 ? "s" : ""} — take payment when they're done`);
      window.dispatchEvent(new Event("CAFYZ_ORDER_SENT"));
      window.dispatchEvent(new Event("CAFYZ_NOTIFICATIONS_REFRESH"));
      busyRef.current = false;
      setBusy(null);
      await loadTableBill(tableId, [], { skipHeal: true });
    } catch {
      /* the API client already showed the reason */
    } finally {
      busyRef.current = false;
      setBusy(b => (b === "send" ? null : b));
    }
  }

  const panelProps = {
    cart, tables, tableId, liveBill, isParcel, busy, ready: loaded, cur, subtotal, totals, taxLabel,
    kitchenPrinter: restaurant?.kitchen_printer?.name ?? null,
    cashierPrinter: restaurant?.cashier_printer?.name ?? null,
    hasLastBill: !!lastBill,
    onTableChange: selectTable,
    onParcelChange: (p: boolean) => { void changeParcel(p); },
    onQty: (key: string, d: number) => { void changeQty(key, d); },
    onPay: (m: PaymentMethod) => { void pay(m); },
    onSend: () => { void sendToKitchen(); },
    onPrintBill: () => { void printReceipt(receiptFor(cart, { table: selectedTable, parcel: isParcel })); },
    onReprint: () => { if (lastBill) void printReceipt(lastBill); },
    onClear: resetBill,
  };

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* ── Menu ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-3 pt-3 pb-2 space-y-2 flex-shrink-0">
          {pending.length > 0 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5" aria-label="Open table bills">
              {pending.map(b => {
                const active = tableId === b.table_id;
                return (
                  <button key={b.table_id} type="button"
                    onClick={() => { selectTable(b.table_id); setShowMobileCart(true); }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 flex-shrink-0 min-h-[46px] touch-manipulation"
                    style={{
                      background: active ? "var(--cafyz-accent-bg)" : "var(--cafyz-surface)",
                      border: `1px solid ${active ? "var(--cafyz-border-focus)" : "var(--cafyz-border)"}`,
                    }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#f59e0b" }} />
                    <span className="text-start">
                      <span className="block" style={{ color: "var(--cafyz-text)", fontSize: "0.78rem", fontWeight: 700 }}>{b.table_name}</span>
                      <span className="block" style={{ color: "var(--cafyz-muted)", fontSize: "0.66rem" }}>
                        {b.items} item{b.items !== 1 ? "s" : ""} · {relSince(b.createdAt)}
                      </span>
                    </span>
                    <span style={{ color: "var(--cafyz-brand)", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "0.84rem" }}>
                      {formatMoney(cur, totalsFor(b.subtotal).grandTotal)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl px-3 min-h-[42px]"
            style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
            <Search size={15} style={{ color: "var(--cafyz-muted)" }} />
            <input type="search" placeholder="Search menu…" value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm py-2"
              style={{ color: "var(--cafyz-text)" }} />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="p-1" style={{ color: "var(--cafyz-muted)" }}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
            {catTabs.map(c => (
              <button key={c.id} type="button" onClick={() => setActiveCat(c.id)}
                className="px-3.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 font-semibold min-h-[34px] touch-manipulation"
                style={activeCat === c.id
                  ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }
                  : { background: "var(--cafyz-surface)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-24 md:pb-4 scrollbar-hide">
          {!loaded ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={24} className="animate-spin" style={{ color: "#1e7fff" }} />
            </div>
          ) : (
            <MenuGrid
              items={filtered}
              qtyById={qtyById}
              cur={cur}
              onAdd={addItem}
              emptyText={search ? `No results for "${search}"` : menu.length === 0 ? "No menu items yet — add them in Menu" : "No items in this category"}
            />
          )}
        </div>
      </div>

      {/* ── Desktop bill ── */}
      <div className="hidden md:flex w-80 lg:w-[22rem] xl:w-96 flex-col flex-shrink-0 border-l"
        style={{ background: "var(--cafyz-surface-subtle)", borderColor: "var(--cafyz-border)" }}>
        <BillPanel {...panelProps} />
      </div>

      {/* ── Mobile: bill button ── */}
      {!showMobileCart && (
        <button type="button" onClick={() => setShowMobileCart(true)} aria-label="View bill"
          className="md:hidden fixed right-4 left-4 z-30 pos-fab-bottom flex items-center gap-3 ps-3.5 pe-3 py-2.5 rounded-2xl min-h-[56px] touch-manipulation active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 8px 24px rgba(30,127,255,0.35)" }}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.2)" }}>
            <ShoppingCart size={18} className="text-white" />
          </span>
          <span className="text-start min-w-0 flex-1">
            <span className="block truncate" style={{ color: "#fff", fontWeight: 700, fontSize: "0.86rem", lineHeight: 1.2 }}>
              {itemCount > 0 ? "View bill & pay" : "Bill"}
            </span>
            <span className="block truncate" style={{ color: "rgba(255,255,255,0.9)", fontSize: "0.7rem", lineHeight: 1.2 }}>
              {itemCount > 0 ? `${itemCount} item${itemCount !== 1 ? "s" : ""} · ${selectedTable?.name ?? (isParcel ? "Takeaway" : "Counter")}` : "Tap items to add them"}
            </span>
          </span>
          {itemCount > 0 && (
            <span className="px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
              style={{ background: "#fff", color: "#1565e0", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "0.86rem" }}>
              {formatMoney(cur, totals.grandTotal)}
            </span>
          )}
        </button>
      )}

      {/* ── Mobile: bill sheet ── */}
      <AnimatePresence>
        {showMobileCart && (
          <>
            <motion.div key="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="md:hidden fixed inset-0 z-40"
              style={{ background: "var(--cafyz-overlay)" }}
              onClick={() => setShowMobileCart(false)} />
            <motion.div key="sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden flex flex-col"
              style={{ background: "var(--cafyz-surface-subtle)", borderTop: "1px solid var(--cafyz-border-strong)", maxHeight: "92dvh", height: "92dvh" }}>
              <div className="flex justify-center pt-2.5 pb-0.5 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: "var(--cafyz-border-strong)" }} />
              </div>
              <BillPanel {...panelProps} isMobile onClose={() => setShowMobileCart(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
