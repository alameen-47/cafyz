import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Plus, Minus, Trash2, Printer, ChevronDown, ChevronUp,
  CreditCard, Banknote, Package, X, Check, Wifi, Bluetooth, Usb,
  ReceiptText, ShoppingCart, ChevronLeft
} from "lucide-react";
import { toast } from "./Toast";

const categories = ["All", "Starters", "Mains", "Biryani", "Pizza", "Desserts", "Drinks"];

const menuItems = [
  { id: "p1",  name: "Paneer Tikka",     cat: "Starters", price: 14, emoji: "🧀", popular: true },
  { id: "p2",  name: "Chicken Wings",    cat: "Starters", price: 12, emoji: "🍗", popular: false },
  { id: "p3",  name: "Caesar Salad",     cat: "Starters", price: 10, emoji: "🥗", popular: false },
  { id: "p4",  name: "Garlic Naan",      cat: "Starters", price:  4, emoji: "🫓", popular: true },
  { id: "p5",  name: "Butter Chicken",   cat: "Mains",    price: 18, emoji: "🍛", popular: true },
  { id: "p6",  name: "Grilled Salmon",   cat: "Mains",    price: 28, emoji: "🐟", popular: false },
  { id: "p7",  name: "Ribeye Steak",     cat: "Mains",    price: 45, emoji: "🥩", popular: true },
  { id: "p8",  name: "Dal Makhani",      cat: "Mains",    price: 12, emoji: "🫕", popular: false },
  { id: "p9",  name: "Veg Biryani",      cat: "Biryani",  price: 14, emoji: "🍚", popular: false },
  { id: "p10", name: "Chicken Biryani",  cat: "Biryani",  price: 16, emoji: "🍲", popular: true },
  { id: "p11", name: "Margherita",       cat: "Pizza",    price: 16, emoji: "🍕", popular: false },
  { id: "p12", name: "Pepperoni",        cat: "Pizza",    price: 18, emoji: "🍕", popular: true },
  { id: "p13", name: "Tiramisu",         cat: "Desserts", price:  9, emoji: "🍰", popular: true },
  { id: "p14", name: "Choc Lava Cake",   cat: "Desserts", price:  8, emoji: "🎂", popular: false },
  { id: "p15", name: "Mango Lassi",      cat: "Drinks",   price:  5, emoji: "🥭", popular: true },
  { id: "p16", name: "Cold Coffee",      cat: "Drinks",   price:  6, emoji: "☕", popular: false },
];

const tables = ["T-01","T-02","T-03","T-04","T-05","T-06","T-07","T-08","T-09","T-10","T-11","T-12"];
const pendingBills = [
  { table: "T-05", items: 4, total: 82, since: "45m" },
  { table: "T-12", items: 3, total: 54, since: "22m" },
  { table: "T-03", items: 6, total: 148, since: "1h 12m" },
];

interface CartItem { id: string; name: string; price: number; qty: number; emoji: string }

function PrinterPopover({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute bottom-14 right-0 w-72 rounded-2xl p-4 z-50 space-y-4"
      style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.2)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
    >
      <div className="flex items-center justify-between">
        <h4 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.9rem" }}>Printer Settings</h4>
        <button onClick={onClose} className="p-1" style={{ color: "#6b82a0" }}><X size={16} /></button>
      </div>
      <div className="space-y-2">
        {[
          { Icon: Bluetooth, label: "Bluetooth Printer", sub: "Not paired", active: false },
          { Icon: Usb,       label: "USB Printer",       sub: "COM3 · Connected", active: true },
          { Icon: Wifi,      label: "Network Printer",   sub: "192.168.1.42", active: false },
        ].map(({ Icon, label, sub, active }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "rgba(30,127,255,0.05)", border: "1px solid rgba(30,127,255,0.08)" }}>
            <Icon size={15} style={{ color: "#1e7fff", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 500 }}>{label}</p>
              <p style={{ color: "#6b82a0", fontSize: "0.68rem" }}>{sub}</p>
            </div>
            <button className="px-2.5 py-1 rounded-lg text-xs font-semibold flex-shrink-0"
              style={active ? { background: "rgba(34,197,94,0.1)", color: "#22c55e" } : { background: "rgba(30,127,255,0.1)", color: "#1e7fff" }}>
              {active ? "Default" : "Connect"}
            </button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["Kitchen Printer","Cashier Printer"].map(lbl => (
          <div key={lbl}>
            <label style={{ color: "#6b82a0", fontSize: "0.68rem", display: "block", marginBottom: 4 }}>{lbl}</label>
            <select className="w-full rounded-lg px-2 py-1.5 text-xs outline-none"
              style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.1)" }}>
              <option>USB Printer</option><option>Bluetooth</option>
            </select>
          </div>
        ))}
      </div>
      <button className="w-full py-2 rounded-xl text-xs font-semibold"
        style={{ background: "rgba(30,127,255,0.1)", color: "#1e7fff", border: "1px solid rgba(30,127,255,0.15)" }}>
        Test Print
      </button>
    </motion.div>
  );
}

// ── Cart Panel (shared between desktop sidebar & mobile sheet) ───────────────
function CartPanel({
  cart, selectedTable, tables, isParcel, editMode, breakdownOpen, showPrinter, charged,
  onTableChange, onParcelToggle, onEditToggle, onBreakdownToggle, onPrinterToggle,
  onUpdateQty, onClear, onCharge, onCash, onClose,
  isMobile,
}: {
  cart: CartItem[]; selectedTable: string; tables: string[]; isParcel: boolean;
  editMode: boolean; breakdownOpen: boolean; showPrinter: boolean; charged: boolean;
  onTableChange: (t: string) => void; onParcelToggle: () => void; onEditToggle: () => void;
  onBreakdownToggle: () => void; onPrinterToggle: () => void;
  onUpdateQty: (id: string, d: number) => void; onClear: () => void;
  onCharge: () => void; onCash: () => void; onClose?: () => void;
  isMobile?: boolean;
}) {
  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const serviceCharge = parseFloat((subtotal * 0.05).toFixed(2));
  const tax = parseFloat((subtotal * 0.18).toFixed(2));
  const grandTotal = subtotal + serviceCharge + tax;
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
              {tables.map(t => <option key={t}>{t}</option>)}
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
            <motion.div key={item.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="flex items-center gap-2 p-2.5 rounded-xl"
              style={{ background: "rgba(30,127,255,0.04)", border: "1px solid rgba(30,127,255,0.08)" }}>
              <span className="text-xl flex-shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 500 }} className="truncate">{item.name}</p>
                <p style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>₹{(item.price * item.qty)}</p>
              </div>
              {editMode ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onUpdateQty(item.id, -1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255,59,92,0.1)" }}>
                    <Minus size={12} style={{ color: "#ff3b5c" }} />
                  </button>
                  <span style={{ color: "#e8eef8", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.85rem", minWidth: 18, textAlign: "center" }}>
                    {item.qty}
                  </span>
                  <button onClick={() => onUpdateQty(item.id, 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(30,127,255,0.1)" }}>
                    <Plus size={12} style={{ color: "#1e7fff" }} />
                  </button>
                  <button onClick={() => onUpdateQty(item.id, -item.qty)}
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
              {[["Subtotal", subtotal], ["Service (5%)", serviceCharge], ["GST (18%)", tax]].map(([l, v]) => (
                <div key={l as string} className="flex justify-between">
                  <span style={{ color: "#6b82a0", fontSize: "0.72rem" }}>{l}</span>
                  <span style={{ color: "#a8bdd4", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>₹{(v as number).toFixed(0)}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between px-3 py-3 rounded-xl"
          style={{ background: "rgba(30,127,255,0.08)", border: "1px solid rgba(30,127,255,0.15)" }}>
          <span style={{ color: "#a8bdd4", fontWeight: 600, fontSize: "0.88rem" }}>Grand Total</span>
          <span style={{ color: "#fff", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "1.4rem" }}>
            ₹{grandTotal.toFixed(0)}
          </span>
        </div>

        <div className="flex gap-2 relative">
          <motion.button whileTap={{ scale: 0.95 }} onClick={onCharge}
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }}>
            {charged ? <><Check size={15} /> Charged!</> : <><CreditCard size={15} /> Charge</>}
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={onCash}
            className="flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
            <Banknote size={15} /> Cash
          </motion.button>
          <button onClick={onPrinterToggle}
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(30,127,255,0.08)", border: "1px solid rgba(30,127,255,0.15)" }}>
            <Printer size={16} style={{ color: "#1e7fff" }} />
          </button>
          <AnimatePresence>
            {showPrinter && <PrinterPopover onClose={onPrinterToggle} />}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function POS() {
  const [activeCat, setActiveCat] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState("T-05");
  const [isParcel, setIsParcel] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(true);
  const [showPrinter, setShowPrinter] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [charged, setCharged] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const filtered = menuItems.filter(m =>
    (activeCat === "All" || m.cat === activeCat) &&
    (search === "" || m.name.toLowerCase().includes(search.toLowerCase()))
  );

  const addToCart = (item: typeof menuItems[0]) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, emoji: item.emoji }];
    });
  };

  const updateQty = (id: string, delta: number) =>
    setCart(prev => prev.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0));

  const handleCharge = () => {
    if (!cart.length) { toast.error("Cart is empty", "Add items before charging"); return; }
    setCharged(true);
    toast.success(`₹${grandTotal.toFixed(0)} charged · ${selectedTable}`, `${itemCount} item${itemCount !== 1 ? "s" : ""} · Card payment`);
    setTimeout(() => { setCharged(false); setCart([]); setShowMobileCart(false); }, 2000);
  };

  const handleCash = () => {
    if (!cart.length) { toast.error("Cart is empty", "Add items before payment"); return; }
    toast.success(`₹${grandTotal.toFixed(0)} received · ${selectedTable}`, `${itemCount} item${itemCount !== 1 ? "s" : ""} · Cash payment`);
    setTimeout(() => { setCart([]); setShowMobileCart(false); }, 1200);
  };

  const itemCount = cart.reduce((s, c) => s + c.qty, 0);
  const grandTotal = cart.reduce((s, c) => s + c.price * c.qty, 0) * 1.23;

  const cartProps = {
    cart, selectedTable, tables, isParcel, editMode, breakdownOpen, showPrinter, charged,
    onTableChange: setSelectedTable,
    onParcelToggle: () => setIsParcel(p => !p),
    onEditToggle: () => setEditMode(e => !e),
    onBreakdownToggle: () => setBreakdownOpen(o => !o),
    onPrinterToggle: () => setShowPrinter(p => !p),
    onUpdateQty: updateQty,
    onClear: () => setCart([]),
    onCharge: handleCharge,
    onCash: handleCash,
  };

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* ── Left: menu panel ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Pending bills strip */}
        <div className="flex gap-2 px-3 pt-3 pb-2 overflow-x-auto scrollbar-hide flex-shrink-0">
          {pendingBills.map(b => (
            <button key={b.table} onClick={() => setSelectedTable(b.table)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 flex-shrink-0 transition-all"
              style={{
                background: selectedTable === b.table ? "rgba(30,127,255,0.12)" : "#0d1326",
                border: `1px solid ${selectedTable === b.table ? "rgba(30,127,255,0.35)" : "rgba(30,127,255,0.1)"}`,
                minHeight: 48,
              }}>
              <div>
                <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 700, fontFamily: "var(--font-display)" }}>{b.table}</p>
                <p style={{ color: "#6b82a0", fontSize: "0.67rem" }}>{b.items} items · {b.since}</p>
              </div>
              <span style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.82rem" }}>₹{b.total}</span>
            </button>
          ))}
          <button className="flex items-center gap-1.5 rounded-xl px-3 py-2 flex-shrink-0"
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
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCat(c)}
                className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 font-medium transition-all"
                style={activeCat === c
                  ? { background: "linear-gradient(135deg, #1e7fff, #00c6ff)", color: "#fff" }
                  : { background: "#0d1326", color: "#6b82a0", border: "1px solid rgba(30,127,255,0.1)" }}>
                {c}
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
                  {item.popular && (
                    <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontSize: "0.58rem" }}>★</span>
                  )}
                  <div className="text-2xl mb-1.5">{item.emoji}</div>
                  <p style={{ color: "#e8eef8", fontSize: "0.78rem", fontWeight: 600, lineHeight: 1.3 }}>{item.name}</p>
                  <p style={{ color: "#1e7fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.85rem", marginTop: 3 }}>₹{item.price}</p>
                  {inCart && (
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "#1e7fff" }}>
                      <span style={{ color: "#fff", fontSize: "0.58rem", fontWeight: 700 }}>{inCart.qty}</span>
                    </div>
                  )}
                </motion.button>
              );
            })}
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
                ₹{grandTotal.toFixed(0)}
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
