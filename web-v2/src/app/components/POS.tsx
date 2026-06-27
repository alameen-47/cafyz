import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Plus, Minus, Printer, ChevronDown, ChevronUp,
  CreditCard, Banknote, X, Check, Wifi, Bluetooth, Usb,
  ReceiptText, ShoppingCart,
} from "lucide-react";
import { toast } from "./Toast";
import {
  menuApi, menuCategoriesApi, ordersApi, restaurantApi, tablesApi,
  type ApiMenuItem, type ApiMenuCategory, type ApiTable, type ApiRestaurant,
} from "../../services/api";
import { getCurrencySymbol } from "../../utils/currency";
import { getRestaurantLogo, syncRestaurantLogoCacheAsync } from "../../services/restaurantLogoStorage";
import { print, type ReceiptData } from "../../services/PrintService";
import { useAppNav } from "../nav";
import { useAuth } from "../auth";
import { PrinterSetupPanel } from "./PrinterSetupPanel";

interface CartItem { id: string; name: string; price: number; qty: number; emoji: string; orderItemId?: string; addedNow?: boolean }
type PaymentState = "open" | "sent" | "card" | "cash" | "comped";

function relSince(iso?: string): string {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

// ── Cart Panel (shared between desktop sidebar & mobile sheet) ───────────────
type BillStatus = "empty" | "building" | "kitchen" | "paid";

function formatMoney(cur: string, amount: number) {
  const rounded = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  return `${cur}${rounded}`;
}

function CartPanel({
  cart, selectedTable, tables, tableName, billStatus, isParcel, editMode, breakdownOpen, showPrinter, charged, busy,
  cur, subtotal, service, tax, grandTotal, serviceRate, taxRate, taxLabel,
  kitchenPrinter, cashierPrinter, restaurantName, restaurantId, logoUrl,
  sendable, onSend,
  onTableChange, onParcelToggle, onEditToggle, onBreakdownToggle, onPrinterToggle,
  onUpdateQty, onClear, onCharge, onCash, onClose, onRestaurantUpdate,
  isMobile,
}: {
  cart: CartItem[]; selectedTable: string; tables: ApiTable[]; tableName: string; billStatus: BillStatus;
  isParcel: boolean; editMode: boolean; breakdownOpen: boolean; showPrinter: boolean; charged: boolean; busy: boolean;
  cur: string; subtotal: number; service: number; tax: number; grandTotal: number;
  serviceRate: number; taxRate: number; taxLabel: string; kitchenPrinter?: string | null; cashierPrinter?: string | null;
  restaurantName?: string; restaurantId?: string; logoUrl?: string | null;
  sendable: boolean; onSend: () => void;
  onTableChange: (t: string) => void; onParcelToggle: () => void; onEditToggle: () => void;
  onBreakdownToggle: () => void; onPrinterToggle: () => void;
  onUpdateQty: (id: string, d: number) => void; onClear: () => void;
  onCharge: () => void; onCash: () => void; onClose?: () => void;
  onRestaurantUpdate: (r: ApiRestaurant) => void;
  isMobile?: boolean;
}) {
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);
  const hasFees = service > 0 || tax > 0;
  const canPay = cart.length > 0 && !!selectedTable && billStatus !== "paid";

  const statusMeta: Record<BillStatus, { label: string; color: string; bg: string }> = {
    empty: { label: "Select a table to start", color: "var(--cafyz-muted)", bg: "rgba(107,130,160,0.1)" },
    building: { label: "New order — not sent yet", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    kitchen: { label: "In kitchen — ready to pay", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    paid: { label: "Payment complete", color: "#1e7fff", bg: "rgba(30,127,255,0.12)" },
  };
  const status = statusMeta[billStatus];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-3 space-y-3 border-b" style={{ borderColor: "var(--cafyz-border)" }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {isMobile ? (
              <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem" }}>
                Order Bill
              </h3>
            ) : (
              <h3 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem" }}>
                Current Bill
              </h3>
            )}
            {tableName ? (
              <p style={{ color: "#1e7fff", fontSize: "0.82rem", fontWeight: 600, marginTop: 2 }}>{tableName}</p>
            ) : (
              <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem", marginTop: 2 }}>No table selected</p>
            )}
          </div>
          {isMobile && onClose && (
            <button onClick={onClose} aria-label="Close bill"
              className="p-2 rounded-xl flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              style={{ background: "rgba(30,127,255,0.08)", color: "var(--cafyz-muted)" }}>
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-fit max-w-full"
          style={{ background: status.bg }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: status.color }} />
          <span style={{ color: status.color, fontSize: "0.72rem", fontWeight: 600 }}>{status.label}</span>
          {isParcel && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-xs flex-shrink-0"
              style={{ background: "rgba(0,198,255,0.15)", color: "#00c6ff" }}>Parcel</span>
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem", display: "block", marginBottom: 4 }}>Table</label>
            <select value={selectedTable} onChange={e => onTableChange(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none min-h-[44px]"
              style={{ background: "var(--cafyz-surface)", color: "var(--cafyz-text)", border: "1px solid rgba(30,127,255,0.15)", fontFamily: "var(--font-mono)" }}>
              <option value="">Choose table…</option>
              {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col items-end justify-end">
            <label style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem", marginBottom: 6, display: "block" }}>Takeaway</label>
            <button type="button" onClick={onParcelToggle} aria-pressed={isParcel}
              className="w-12 h-7 rounded-full relative transition-all flex-shrink-0"
              style={{ background: isParcel ? "#1e7fff" : "rgba(30,127,255,0.12)" }}>
              <div className="w-5 h-5 rounded-full bg-white absolute transition-all shadow-sm top-1/2 -translate-y-1/2"
                style={{ left: isParcel ? "calc(100% - 22px)" : 4 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-4 py-3 scrollbar-hide">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3 rounded-xl"
            style={{ border: "1px dashed rgba(30,127,255,0.12)" }}>
            <ReceiptText size={28} style={{ color: "var(--cafyz-muted)" }} />
            <div>
              <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.85rem", fontWeight: 600 }}>Bill is empty</p>
              <p style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem", marginTop: 4 }}>Tap menu items to add them here</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[2rem_1fr_auto] gap-2 px-1 pb-1.5 border-b"
              style={{ borderColor: "rgba(30,127,255,0.08)", color: "var(--cafyz-muted)", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <span>Qty</span>
              <span>Item</span>
              <span className="text-right">Amount</span>
            </div>
            <AnimatePresence initial={false}>
              {cart.map(item => (
                <motion.div key={item.orderItemId ?? item.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                  className="grid grid-cols-[2rem_1fr_auto] gap-2 items-center py-2.5 px-1 rounded-lg"
                  style={{
                    background: item.addedNow ? "rgba(0,198,255,0.06)" : "transparent",
                    borderBottom: "1px solid rgba(30,127,255,0.06)",
                  }}>
                  <div className="flex flex-col items-center gap-0.5">
                    {editMode ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <button disabled={busy} onClick={() => onUpdateQty(item.id, 1)}
                          className="w-7 h-7 rounded-md flex items-center justify-center"
                          style={{ background: "var(--cafyz-border)" }}>
                          <Plus size={12} style={{ color: "#1e7fff" }} />
                        </button>
                        <span style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.8rem" }}>{item.qty}</span>
                        <button disabled={busy} onClick={() => onUpdateQty(item.id, -1)}
                          className="w-7 h-7 rounded-md flex items-center justify-center"
                          style={{ background: "rgba(255,59,92,0.1)" }}>
                          <Minus size={12} style={{ color: "#ff3b5c" }} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.85rem" }}>{item.qty}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p style={{ color: "var(--cafyz-text)", fontSize: "0.82rem", fontWeight: 500, lineHeight: 1.3 }} className="truncate">
                      <span className="mr-1.5" aria-hidden>{item.emoji}</span>{item.name}
                    </p>
                    <p style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem", marginTop: 2 }}>
                      {formatMoney(cur, item.price)} each
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.82rem" }}>
                      {formatMoney(cur, item.price * item.qty)}
                    </span>
                    {editMode && (
                      <button disabled={busy} onClick={() => onUpdateQty(item.id, -item.qty)}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ color: "#ff3b5c", background: "rgba(255,59,92,0.08)" }}>
                        Remove
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <p style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem", paddingTop: 8 }}>
              {itemCount} item{itemCount !== 1 ? "s" : ""} on this bill
            </p>
          </div>
        )}
      </div>

      {/* Totals + actions */}
      <div className="flex-shrink-0 px-3 sm:px-4 py-3 space-y-3 border-t safe-area-pb"
        style={{ borderColor: "var(--cafyz-border)", background: "var(--cafyz-overlay)" }}>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.8rem" }}>Subtotal</span>
            <span style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 600 }}>
              {formatMoney(cur, subtotal)}
            </span>
          </div>
          {hasFees && (
            <>
              <button type="button" onClick={onBreakdownToggle}
                className="w-full flex items-center justify-between py-0.5">
                <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>
                  {breakdownOpen ? "Hide" : "Show"} fees & tax
                </span>
                {breakdownOpen ? <ChevronUp size={14} style={{ color: "var(--cafyz-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--cafyz-muted)" }} />}
              </button>
              <AnimatePresence initial={false}>
                {breakdownOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-1 pl-1">
                    {serviceRate > 0 && (
                      <div className="flex justify-between">
                        <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>Service ({serviceRate}%)</span>
                        <span style={{ color: "var(--cafyz-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{formatMoney(cur, service)}</span>
                      </div>
                    )}
                    {taxRate > 0 && (
                      <div className="flex justify-between">
                        <span style={{ color: "var(--cafyz-muted)", fontSize: "0.72rem" }}>{taxLabel} ({taxRate}%)</span>
                        <span style={{ color: "var(--cafyz-text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{formatMoney(cur, tax)}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-3 rounded-xl"
          style={{ background: "linear-gradient(135deg, rgba(30,127,255,0.15), rgba(0,198,255,0.08))", border: "1px solid rgba(30,127,255,0.2)" }}>
          <span style={{ color: "var(--cafyz-text)", fontWeight: 700, fontSize: isMobile ? "0.95rem" : "0.88rem" }}>Total to pay</span>
          <span style={{ color: "var(--cafyz-text-strong)", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: isMobile ? "1.5rem" : "1.35rem" }}>
            {formatMoney(cur, grandTotal)}
          </span>
        </div>

        {sendable && (
          <motion.button whileTap={{ scale: 0.98 }} disabled={busy} onClick={onSend}
            className="w-full py-3.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 min-h-[48px]"
            style={{ background: "linear-gradient(135deg, #ff6b35, #f59e0b)", color: "#fff", opacity: busy ? 0.6 : 1 }}>
            <ReceiptText size={16} /> Send to kitchen
          </motion.button>
        )}

        <AnimatePresence>
          {showPrinter && isMobile && (
            <PrinterSetupPanel compact onClose={onPrinterToggle} kitchen={kitchenPrinter} cashier={cashierPrinter}
              onRestaurantUpdate={onRestaurantUpdate} restaurantName={restaurantName} restaurantId={restaurantId} logoUrl={logoUrl} />
          )}
        </AnimatePresence>

        <div className={`grid gap-2 ${canPay ? "grid-cols-2" : "grid-cols-1"}`}>
          {canPay && (
            <>
              <motion.button whileTap={{ scale: 0.98 }} disabled={busy || charged} onClick={onCharge}
                className="py-3.5 rounded-xl text-sm font-semibold flex flex-col items-center justify-center gap-0.5 min-h-[52px]"
                style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff", opacity: busy || charged ? 0.6 : 1 }}>
                {charged ? <><Check size={18} /> <span>Paid</span></> : <><CreditCard size={18} /> <span>Card</span></>}
              </motion.button>
              <motion.button whileTap={{ scale: 0.98 }} disabled={busy || charged} onClick={onCash}
                className="py-3.5 rounded-xl text-sm font-semibold flex flex-col items-center justify-center gap-0.5 min-h-[52px]"
                style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", opacity: busy || charged ? 0.6 : 1 }}>
                <Banknote size={18} /> <span>Cash</span>
              </motion.button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-1.5 flex-wrap">
            <button type="button" onClick={onEditToggle}
              className="px-3 py-2 rounded-lg text-xs font-medium min-h-[40px]"
              style={editMode ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b" } : { background: "rgba(30,127,255,0.06)", color: "var(--cafyz-text-secondary)" }}>
              {editMode ? "Done editing" : "Edit items"}
            </button>
            <button type="button" onClick={onClear} disabled={cart.length === 0}
              className="px-3 py-2 rounded-lg text-xs font-medium min-h-[40px] disabled:opacity-40"
              style={{ background: "rgba(255,59,92,0.08)", color: "#ff3b5c" }}>
              Clear bill
            </button>
          </div>
          <div className="relative flex-shrink-0">
            <button type="button" onClick={onPrinterToggle} aria-label="Printer settings"
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(30,127,255,0.08)", border: "1px solid rgba(30,127,255,0.15)" }}>
              <Printer size={17} style={{ color: "#1e7fff" }} />
            </button>
            {!isMobile && showPrinter && (
              <PrinterSetupPanel onClose={onPrinterToggle} kitchen={kitchenPrinter} cashier={cashierPrinter}
                onRestaurantUpdate={onRestaurantUpdate} restaurantName={restaurantName} restaurantId={restaurantId} logoUrl={logoUrl} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type PendingBill = { id: string; table_id?: string; table_name: string; items: number; total: number; since: string };

function mergePendingByTable(rows: PendingBill[]): PendingBill[] {
  const byTable = new Map<string, PendingBill>();
  for (const row of rows) {
    const key = row.table_id ?? row.id;
    const existing = byTable.get(key);
    if (!existing) {
      byTable.set(key, row);
      continue;
    }
    byTable.set(key, {
      ...existing,
      items: existing.items + row.items,
      total: existing.total + row.total,
    });
  }
  return Array.from(byTable.values());
}

function OpenBillsStrip({
  pending, selectedTable, cur, onOpenBill, onNewBill,
}: {
  pending: PendingBill[];
  selectedTable: string;
  cur: string;
  onOpenBill: (tableId: string) => void;
  onNewBill: () => void;
}) {
  const isNewBillActive = !selectedTable;
  return (
    <div className="flex-shrink-0 border-b" style={{ borderColor: "rgba(30,127,255,0.08)" }}>
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <p style={{ color: "var(--cafyz-text-secondary)", fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Open bills
        </p>
        {pending.length > 0 && (
          <span className="px-2 py-0.5 rounded-full"
            style={{ background: "rgba(30,127,255,0.12)", color: "#1e7fff", fontSize: "0.65rem", fontWeight: 700 }}>
            {pending.length}
          </span>
        )}
      </div>
      <div className="flex gap-2 px-3 pb-3 overflow-x-auto scrollbar-hide">
        <button type="button" onClick={onNewBill}
          className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 flex-shrink-0 transition-all min-h-[52px] min-w-[108px]"
          style={{
            background: isNewBillActive ? "rgba(30,127,255,0.14)" : "var(--cafyz-surface)",
            borderStyle: isNewBillActive ? "solid" : "dashed",
            borderWidth: 1,
            borderColor: isNewBillActive ? "rgba(30,127,255,0.45)" : "rgba(30,127,255,0.22)",
          }}>
          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(30,127,255,0.15)" }}>
            <Plus size={15} style={{ color: "#1e7fff" }} />
          </span>
          <span style={{ color: isNewBillActive ? "var(--cafyz-text)" : "var(--cafyz-text-secondary)", fontSize: "0.78rem", fontWeight: 700 }}>
            New bill
          </span>
        </button>

        {pending.length === 0 ? (
          <div className="flex items-center px-3 py-2.5 rounded-xl flex-shrink-0 min-h-[52px]"
            style={{ background: "var(--cafyz-surface)", border: "1px dashed rgba(30,127,255,0.12)" }}>
            <span style={{ color: "var(--cafyz-muted)", fontSize: "0.75rem" }}>No open table bills yet</span>
          </div>
        ) : (
          pending.map(b => {
            const isActive = !!b.table_id && selectedTable === b.table_id;
            return (
              <button key={b.table_id ?? b.id} type="button"
                onClick={() => { if (b.table_id) onOpenBill(b.table_id); }}
                disabled={!b.table_id}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 flex-shrink-0 transition-all min-h-[52px] disabled:opacity-50"
                style={{
                  background: isActive ? "rgba(30,127,255,0.14)" : "var(--cafyz-surface)",
                  border: `1px solid ${isActive ? "rgba(30,127,255,0.4)" : "var(--cafyz-border)"}`,
                  minWidth: 132,
                }}>
                <div className="text-left min-w-0 flex-1">
                  <p className="truncate" style={{ color: "var(--cafyz-text)", fontSize: "0.8rem", fontWeight: 700 }}>{b.table_name}</p>
                  <p style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem" }}>
                    {b.items} item{b.items !== 1 ? "s" : ""} · {b.since}
                  </p>
                </div>
                <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "0.88rem", flexShrink: 0 }}>
                  {formatMoney(cur, b.total)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function MobileBillFab({
  itemCount, grandTotal, cur, onOpen,
}: {
  itemCount: number;
  grandTotal: number;
  cur: string;
  onOpen: () => void;
}) {
  const hasItems = itemCount > 0;
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      onClick={onOpen}
      aria-label={hasItems ? "View bill" : "Open bill"}
      className="lg:hidden fixed right-4 z-30 pos-fab-bottom flex items-center gap-2.5 pl-3.5 pr-4 py-3 rounded-2xl shadow-2xl min-h-[52px] max-w-[calc(100vw-2rem)]"
      style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 8px 24px rgba(30,127,255,0.4)" }}
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.18)" }}>
        <ShoppingCart size={18} className="text-white" />
      </span>
      <div className="text-left min-w-0 flex-1">
        <p className="truncate" style={{ color: "var(--cafyz-text-strong)", fontWeight: 700, fontSize: "0.82rem", lineHeight: 1.2 }}>
          {hasItems ? "View bill" : "Open bill"}
        </p>
        <p className="truncate" style={{ color: "rgba(255,255,255,0.82)", fontSize: "0.68rem", lineHeight: 1.2 }}>
          {hasItems ? `${itemCount} item${itemCount !== 1 ? "s" : ""}` : "Table, items & payment"}
        </p>
      </div>
      {hasItems && (
        <span style={{ background: "#fff", color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "0.82rem" }}
          className="px-2.5 py-1 rounded-full flex-shrink-0 whitespace-nowrap">
          {formatMoney(cur, grandTotal)}
        </span>
      )}
    </motion.button>
  );
}

export function POS() {
  const { user } = useAuth();
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
  const [breakdownOpen, setBreakdownOpen] = useState(false);
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
        void syncRestaurantLogoCacheAsync(r);
      })
      .catch(() => { /* render empty on failure */ });
  }, []);

  // ── Pending table bills (kitchen-sent orders) — polled like the cashier panel ─
  const refreshPending = useCallback(async () => {
    try {
      const [liveRows, tableRows] = await Promise.all([ordersApi.live(), tablesApi.list()]);
      setTables(tableRows);
      const rows = liveRows.filter(o => o.status === 'sent');
      const enriched: PendingBill[] = rows.map((o) => {
        const items = (o.items ?? []).reduce((s, it) => s + it.qty, 0);
        const total = o.subtotal ?? (o.items ?? []).reduce((s, it) => s + (it.price ?? 0) * it.qty, 0);
        return { id: o.id, table_id: o.table_id, table_name: o.table_name || "No table", items, total, since: relSince(o.created_at) };
      });
      setPending(mergePendingByTable(enriched));
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

  // ── Reset the working bill (keeps table selection unless starting fresh) ───
  function resetBill(opts?: { clearTable?: boolean }) {
    setCart([]);
    setActiveOrderId(null);
    setPayState("open");
    setIsParcel(false);
    setEditMode(false);
    setCharged(false);
    if (opts?.clearTable) setSelectedTable("");
  }

  function startNewBill() {
    resetBill({ clearTable: true });
    setShowMobileCart(true);
  }

  async function openTableBill(tableId: string) {
    await handleTableChange(tableId);
    setShowMobileCart(true);
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
      const [orders, tableRows] = await Promise.all([
        ordersApi.list({ table_id: tableId }),
        tablesApi.list(),
      ]);
      setTables(tableRows);
      const sent = orders.find(o => o.status === "sent");
      const tableStatus = tableRows.find(t => t.id === tableId)?.status;
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

  // ── Customer receipt (logo + totals) after payment ─────────────────────────
  function buildReceiptData(payMethod: string): ReceiptData {
    const address = [restaurant?.address_line1, restaurant?.address_line2, restaurant?.city, restaurant?.postal_code, restaurant?.country]
      .filter(Boolean).join(", ");
    const tableObj = tables.find(t => t.id === selectedTable);
    return {
      restaurantName: restaurant?.name || user?.restaurant_name || "Restaurant",
      currencySymbol: cur,
      logoUrl: getRestaurantLogo(user?.restaurant_id ?? restaurant?.id, restaurant?.logo_url),
      addressLine: address || undefined,
      phone: restaurant?.contact_phone || undefined,
      taxId: restaurant?.tax_id || undefined,
      tableName: tableObj?.name ?? tableName,
      serverName: user?.name,
      covers: tableObj?.covers || undefined,
      items: cart.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
      subtotal,
      service,
      tax,
      total: grandTotal,
      serviceRate,
      taxRate,
      taxLabel,
      taxIncluded,
      payMethod,
      footer: restaurant?.receipt_footer || undefined,
    };
  }

  async function printCustomerReceipt(payMethod: string) {
    try {
      const cashierChannel = restaurant?.cashier_printer?.channel;
      const method = await print(
        buildReceiptData(payMethod),
        undefined,
        32,
        user?.restaurant_id ?? restaurant?.id,
        cashierChannel ? { channel: cashierChannel } : undefined,
      );
      if (method === "dialog") {
        toast.success("Receipt ready", "Use the print dialog to finish.");
      }
    } catch (e) {
      toast.error("Receipt print failed", (e as Error).message);
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
      if (method === "card") {
        setCharged(true);
        setPayState("card");
      } else {
        setPayState("cash");
      }
      const tName = tables.find(t => t.id === selectedTable)?.name ?? "";
      const paidTable = selectedTable;
      toast.success(
        `${formatMoney(cur, grandTotal)} ${method === "card" ? "charged" : "received"} · ${tName}`,
        `${itemCount} item${itemCount !== 1 ? "s" : ""} · ${method === "card" ? "Card" : "Cash"} payment`,
      );
      void printCustomerReceipt(method === "card" ? "Card" : "Cash");
      window.dispatchEvent(new Event("CAFYZ_ORDER_SENT"));
      window.dispatchEvent(new Event("CAFYZ_NOTIFICATIONS_REFRESH"));
      setTimeout(() => {
        void (async () => {
          setCharged(false);
          resetBill();
          setShowMobileCart(false);
          await refreshPending();
          if (paidTable) await handleTableChange(paidTable);
        })();
      }, method === "card" ? 1600 : 1100);
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
      window.dispatchEvent(new Event("CAFYZ_NOTIFICATIONS_REFRESH"));
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
  const tableName = tables.find(t => t.id === selectedTable)?.name ?? "";
  const billStatus: BillStatus = isPaid ? "paid" : canEditBill ? "kitchen" : !selectedTable ? "empty" : "building";

  const cartProps = {
    cart, selectedTable, tables, tableName, billStatus, isParcel, editMode, breakdownOpen, showPrinter, charged, busy,
    cur, subtotal, service, tax, grandTotal, serviceRate, taxRate, taxLabel,
    kitchenPrinter: kitchenPrinterName, cashierPrinter: cashierPrinterName,
    restaurantName: restaurant?.name ?? 'Cafyz',
    restaurantId: restaurant?.id,
    logoUrl: getRestaurantLogo(restaurant?.id, restaurant?.logo_url) ?? null,
    sendable,
    onSend: () => void sendToKitchen(),
    onTableChange: handleTableChange,
    onParcelToggle: () => void toggleParcel(),
    onEditToggle: () => setEditMode(e => !e),
    onBreakdownToggle: () => setBreakdownOpen(o => !o),
    onPrinterToggle: () => setShowPrinter(p => !p),
    onUpdateQty: (id: string, d: number) => void updateQty(id, d),
    onClear: () => resetBill(),
    onCharge: () => void handleCharge("card"),
    onCash: () => void handleCharge("cash"),
    onRestaurantUpdate: setRestaurant,
  };

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* ── Left: menu panel ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <OpenBillsStrip
          pending={pending}
          selectedTable={selectedTable}
          cur={cur}
          onOpenBill={tableId => { void openTableBill(tableId); }}
          onNewBill={startNewBill}
        />

        {/* Search + categories */}
        <div className="px-3 pb-2 space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--cafyz-surface)", border: "1px solid var(--cafyz-border)" }}>
            <Search size={14} style={{ color: "var(--cafyz-muted)" }} />
            <input type="text" placeholder="Search menu..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-[var(--cafyz-muted)]"
              style={{ color: "var(--cafyz-text)" }} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
            {catTabs.map(c => (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 font-medium transition-all"
                style={activeCat === c.id
                  ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }
                  : { background: "var(--cafyz-surface)", color: "var(--cafyz-muted)", border: "1px solid var(--cafyz-border)" }}>
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
                    background: inCart ? "rgba(30,127,255,0.08)" : "var(--cafyz-surface)",
                    border: `1px solid ${inCart ? "rgba(30,127,255,0.25)" : "rgba(30,127,255,0.08)"}`,
                    minHeight: 100,
                  }}>
                  {item.is_popular ? (
                    <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: "0.58rem" }}>★</span>
                  ) : null}
                  <div className="text-2xl mb-1.5">{item.symbol}</div>
                  <p style={{ color: "var(--cafyz-text)", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.3 }}>{item.name}</p>
                  <p style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.85rem", marginTop: 3 }}>{cur}{item.price}</p>
                  {inCart && (
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "#1e7fff" }}>
                      <span style={{ color: "var(--cafyz-text-strong)", fontSize: "0.58rem", fontWeight: 700 }}>{inCart.qty}</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-full flex items-center justify-center h-32">
                <p style={{ color: "var(--cafyz-muted)", fontSize: "0.8rem" }}>
                  {search ? `No results for "${search}"` : "No items in this category"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop: right sidebar cart ── */}
      <div className="hidden lg:flex w-80 xl:w-96 flex-col flex-shrink-0 border-l"
        style={{ background: "var(--cafyz-surface-subtle)", borderColor: "var(--cafyz-border)" }}>
        <CartPanel {...cartProps} />
      </div>

      {/* ── Mobile: floating cart button ── */}
      <AnimatePresence>
        {!showMobileCart && (
          <MobileBillFab
            itemCount={itemCount}
            grandTotal={grandTotal}
            cur={cur}
            onOpen={() => setShowMobileCart(true)}
          />
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
              style={{ background: "var(--cafyz-surface-subtle)", border: "1px solid rgba(30,127,255,0.15)", maxHeight: "92dvh" }}
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
