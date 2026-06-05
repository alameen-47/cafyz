import { useState, useEffect, useRef } from 'react';
import { menuApi, menuCategoriesApi, ordersApi, restaurantApi, tablesApi, type ApiMenuCategory, type ApiMenuItem, type ApiRestaurant, type ApiTable } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  connectBluetooth, connectUSB, disconnectPrinter, printerStatus, print as printReceipt,
  type ReceiptData,
} from '../services/PrintService';
import { PrinterHelpBanner } from '../components/PrinterHelpBanner';
import { getPrinterEnvironment, isIosDevice } from '../services/printerEnvironment';
import { getRestaurantLogo, syncRestaurantLogoCache } from '../services/restaurantLogoStorage';
import { buildMenuCategoryTabs, defaultCategorySlug } from '../utils/menuCategories';
import { MenuItemImage } from '../components/MenuItemImage';
import { Modal } from '../components/Modal';
import './POSPanel.css';

type CartItem     = { menuItem: ApiMenuItem; qty: number; mods: string[] };
type PaymentState = 'open' | 'sent' | 'card' | 'cash' | 'comped';

export function POSPanel() {
  const { user } = useAuth();

  const [menu,          setMenu]          = useState<ApiMenuItem[]>([]);
  const [categories,    setCategories]    = useState<ApiMenuCategory[]>([]);
  const [tables,        setTables]        = useState<ApiTable[]>([]);
  const [cat,           setCat]           = useState('mains');
  const [search,        setSearch]        = useState('');
  const [cart,          setCart]          = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [payState,      setPayState]      = useState<PaymentState>('open');
  const [note,          setNote]          = useState('');
  const [noteOpen,      setNoteOpen]      = useState(false);
  const [splitMode,     setSplitMode]     = useState(false);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(true);
  const [restaurant,    setRestaurant]    = useState<ApiRestaurant | null>(null);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [profileBusy,   setProfileBusy]   = useState(false);
  const [profileDraft,  setProfileDraft]  = useState({
    name: '', contact_phone: '', contact_email: '',
    address_line1: '', address_line2: '', city: '', country: '', postal_code: '', tax_id: '',
  });
  const noteRef = useRef<HTMLInputElement>(null);

  // ── Printer state ──────────────────────────────────────────────────────────
  const [printer,      setPrinter]      = useState<{ type: 'none' | 'bluetooth' | 'usb'; name: string }>({ type: 'none', name: '' });
  const [printBusy,    setPrintBusy]    = useState(false);
  const [printError,   setPrintError]   = useState('');
  const [printOk,      setPrintOk]      = useState(false);
  const [showConnect,  setShowConnect]  = useState(false);

  // Sync printer status on mount (in case a previous session still has a device)
  useEffect(() => { setPrinter(printerStatus()); }, []);

  useEffect(() => {
    Promise.all([menuApi.list(), menuCategoriesApi.list(), tablesApi.list(), restaurantApi.me()])
      .then(([m, cats, t, r]) => {
        setMenu(m);
        setCategories(cats);
        setCat(defaultCategorySlug(cats));
        setTables(t);
        setRestaurant(r);
        syncRestaurantLogoCache(r);
        setProfileDraft({
          name: r.name ?? '', contact_phone: r.contact_phone ?? '', contact_email: r.contact_email ?? '',
          address_line1: r.address_line1 ?? '', address_line2: r.address_line2 ?? '', city: r.city ?? '', country: r.country ?? '',
          postal_code: r.postal_code ?? '', tax_id: r.tax_id ?? '',
        });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Focus note input when it opens
  useEffect(() => {
    if (noteOpen) noteRef.current?.focus();
  }, [noteOpen]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const categorised = buildMenuCategoryTabs(categories, menu);

  const visible = menu
    .filter(m => cat === 'all' || m.category === cat)
    .filter(m => !search.trim() ||
      m.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      m.description?.toLowerCase().includes(search.trim().toLowerCase()));

  const cartMap = Object.fromEntries(cart.map(c => [c.menuItem.id, c.qty]));
  const tableObj = tables.find(t => t.id === selectedTable);
  const printerEnv = getPrinterEnvironment();

  const subtotal = cart.reduce((s, c) => s + c.menuItem.price * c.qty, 0);
  const billable = payState === 'comped' ? 0 : subtotal;
  const serviceRate = Math.max(0, Number(restaurant?.service_charge_pct ?? 18));
  const taxRate = Math.max(0, Number(restaurant?.tax_rate_pct ?? 8.75));
  const taxType = (restaurant?.tax_type || 'Tax').trim() || 'Tax';
  const taxIncluded = restaurant?.tax_included === 1 || restaurant?.tax_included === true;
  const service = billable * (serviceRate / 100);
  const taxableAmount = billable + service;
  const tax = taxIncluded && taxRate > 0
    ? taxableAmount - taxableAmount / (1 + taxRate / 100)
    : taxableAmount * (taxRate / 100);
  const preTaxTotal = taxableAmount - tax;
  const total = taxIncluded ? taxableAmount : taxableAmount + tax;

  const isPaid   = payState === 'card' || payState === 'cash' || payState === 'comped';
  const statusLabel = payState === 'card'  ? 'Paid · Card'
    : payState === 'cash'  ? 'Paid · Cash'
    : payState === 'sent'  ? 'Sent to Kitchen'
    : payState === 'comped'? 'Comped'
    : splitMode            ? 'Split'
    : 'Open';
  const statusClass = isPaid || payState === 'sent' ? 'badge-paid' : 'badge-pending';

  // ── Cart helpers ───────────────────────────────────────────────────────────
  function addItem(item: ApiMenuItem) {
    if (isPaid || payState === 'sent') return; // lock cart once order is sent
    setCart(prev => {
      const i = prev.findIndex(c => c.menuItem.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { menuItem: item, qty: 1, mods: [] }];
    });
  }

  function changeQty(id: string, delta: number) {
    if (isPaid || payState === 'sent') return;
    setCart(prev =>
      prev.map(c => c.menuItem.id === id ? { ...c, qty: c.qty + delta } : c)
          .filter(c => c.qty > 0)
    );
  }

  // ── Reset check ────────────────────────────────────────────────────────────
  function resetCheck() {
    setCart([]);
    setSelectedTable('');
    setActiveOrderId(null);
    setPayState('open');
    setSplitMode(false);
    setNote('');
    setNoteOpen(false);
    setError('');
    setPrintOk(false);
    setPrintError('');
  }

  // When table selection changes, reset the order state (keep cart)
  function handleTableChange(tableId: string) {
    setSelectedTable(tableId);
    setActiveOrderId(null);
    setPayState('open');
    setSplitMode(false);
    setError('');
  }

  // ── Ensure order exists and items are added ────────────────────────────────
  async function ensureOrder(): Promise<string> {
    if (activeOrderId) return activeOrderId;
    const order = await ordersApi.create({
      table_id: selectedTable || undefined,
      covers:   tableObj?.covers || 2,
      note:     note || undefined,
    });
    setActiveOrderId(order.id);
    for (const c of cart) {
      await ordersApi.addItem(order.id, {
        menu_item_id: c.menuItem.id,
        qty:          c.qty,
        mods:         c.mods,
      });
    }
    return order.id;
  }

  // ── Send to kitchen ────────────────────────────────────────────────────────
  async function handleSend() {
    if (cart.length === 0 || isPaid || payState === 'sent') return;
    setBusy(true); setError('');
    try {
      const orderId = await ensureOrder();
      await ordersApi.updateStatus(orderId, 'sent');          // triggers KDS ticket creation in backend
      if (selectedTable) {
        await tablesApi.updateStatus(selectedTable, { status: 'occupied', course: 'Order sent' });
      }
      setPayState('sent');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Charge (card / cash) ───────────────────────────────────────────────────
  async function handleCharge(method: 'card' | 'cash') {
    if (cart.length === 0 || isPaid) return;
    setBusy(true); setError('');
    try {
      // If already sent, activeOrderId is set — just mark paid.
      // If not sent yet, create order + items first.
      const orderId = await ensureOrder();
      // If the order was only 'sent' so far, mark it paid now
      await ordersApi.updateStatus(orderId, 'paid');
      if (selectedTable) {
        await tablesApi.updateStatus(selectedTable, { status: 'empty', course: '', covers: 0 });
      }
      setPayState(method);
      setActiveOrderId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Printer helpers ────────────────────────────────────────────────────────
  async function handleConnectBluetooth() {
    setPrintBusy(true); setPrintError('');
    try {
      const name = await connectBluetooth();
      setPrinter({ type: 'bluetooth', name });
      setShowConnect(false);
    } catch (e) { setPrintError((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  async function handleConnectUSB() {
    setPrintBusy(true); setPrintError('');
    try {
      const name = await connectUSB();
      setPrinter({ type: 'usb', name });
      setShowConnect(false);
    } catch (e) { setPrintError((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  function handleDisconnect() {
    disconnectPrinter();
    setPrinter({ type: 'none', name: '' });
  }

  function buildReceiptData(payMethod?: string): ReceiptData {
    const address = [restaurant?.address_line1, restaurant?.address_line2, restaurant?.city, restaurant?.postal_code, restaurant?.country]
      .filter(Boolean).join(', ');
    return {
      restaurantName: restaurant?.name || user?.restaurant_name || 'Restaurant',
      logoUrl:        getRestaurantLogo(user?.restaurant_id ?? restaurant?.id, restaurant?.logo_url),
      addressLine:    address || undefined,
      phone:          restaurant?.contact_phone || undefined,
      taxId:          restaurant?.tax_id || undefined,
      tableName:      tableObj?.name ?? selectedTable ?? '',
      serverName:     user?.name,
      covers:         tableObj?.covers || undefined,
      items:          cart.map(c => ({ name: c.menuItem.name, qty: c.qty, price: c.menuItem.price })),
      subtotal,
      service,
      tax,
      total,
      serviceRate,
      taxRate,
      taxLabel: taxType,
      taxIncluded,
      payMethod,
      note: note || undefined,
    };
  }

  async function saveProfile() {
    setProfileBusy(true); setError('');
    try {
      const updated = await restaurantApi.update(profileDraft);
      setRestaurant(updated);
      const stored = localStorage.getItem('cafyz_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.restaurant_name = updated.name;
          localStorage.setItem('cafyz_user', JSON.stringify(parsed));
        } catch {
          // ignore local storage parse failures
        }
      }
      setProfileOpen(false);
    } catch (e) { setError((e as Error).message); }
    finally { setProfileBusy(false); }
  }

  async function handlePrint(payMethod?: string) {
    if (cart.length === 0) return;
    setPrintBusy(true); setPrintError(''); setPrintOk(false);
    try {
      const method = await printReceipt(
        buildReceiptData(payMethod),
        undefined,
        32,
        user?.restaurant_id ?? restaurant?.id,
      );
      setPrintOk(true);
      if (method !== 'dialog') {
        setTimeout(() => setPrintOk(false), 3000);
      }
    } catch (e) { setPrintError((e as Error).message); }
    finally { setPrintBusy(false); }
  }

  // ── Comp ───────────────────────────────────────────────────────────────────
  async function handleComp() {
    if (cart.length === 0 || isPaid) return;
    setBusy(true); setError('');
    try {
      const orderId = await ensureOrder();
      await ordersApi.updateStatus(orderId, 'comped');
      if (selectedTable) {
        await tablesApi.updateStatus(selectedTable, { status: 'empty', course: '', covers: 0 });
      }
      setPayState('comped');
      setActiveOrderId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  if (loading) return (
    <div className="pos-layout">
      <p style={{ color: 'var(--text2)', padding: 32 }}>Loading menu…</p>
    </div>
  );

  return (
    <div className="pos-layout">

      {/* ── Menu grid ──────────────────────────────────────────────────── */}
      <section className="pos-grid">
        <div className="pos-toolbar">
          {categorised.map(c => (
            <button key={c.id} type="button"
              className={`pos-pill ${cat === c.id ? 'active' : ''}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
              {c.count > 0 && <span className="mono">{c.count}</span>}
            </button>
          ))}
          <div className="pos-search">
            <span>🔍</span>
            <input
              placeholder="Search menu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 12 }}>
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="pos-dishes">
          {visible.map(d => (
            <button key={d.id} type="button"
              className={`pos-dish card ${cartMap[d.id] ? 'selected' : ''} ${isPaid || payState === 'sent' ? 'disabled' : ''}`}
              onClick={() => addItem(d)}
              disabled={isPaid || payState === 'sent'}
            >
              <div className="pos-dish-plate">
                <MenuItemImage imageUrl={d.image_url} name={d.name} variant="pos-plate" />
                {d.is_popular === 1 && <span className="pos-popular">★ Popular</span>}
                {cartMap[d.id] && <span className="pos-dish-qty mono">× {cartMap[d.id]}</span>}
              </div>
              <div className="pos-dish-info">
                <p className="pos-dish-name">{d.name}</p>
                <p className="pos-dish-price mono">${d.price.toFixed(2)}</p>
                <p className="pos-dish-sub">{d.description}</p>
              </div>
            </button>
          ))}
          {visible.length === 0 && (
            <p style={{ color: 'var(--text3)', padding: 24, gridColumn: '1/-1' }}>
              {search ? `No results for "${search}"` : 'No items in this category.'}
            </p>
          )}
        </div>
      </section>

      {/* ── Order sidebar ──────────────────────────────────────────────── */}
      <aside className="pos-order">

        {/* ── Printer status bar ─────────────────────────────────────────── */}
        <div className="pos-printer-bar">
          <PrinterHelpBanner />
          <div className="pos-printer-bar-row">
            {printer.type !== 'none' ? (
              <span className="pos-printer-connected">
                {printer.type === 'bluetooth' ? '🔵' : '🔌'} {printer.name}
                <button type="button" className="pos-printer-disconnect" onClick={handleDisconnect}>×</button>
              </span>
            ) : (
              <span className="pos-printer-idle">No printer connected</span>
            )}
            <button
              type="button"
              className="pos-printer-trigger"
              onClick={() => setShowConnect(true)}
              disabled={printBusy}
            >
              {printer.type === 'none' ? 'Setup Printer' : 'Change Printer'}
            </button>
          </div>

          {printError && (
            <p className="pos-printer-error">{printError}</p>
          )}
          {printOk && (
            <p className="pos-printer-ok">✓ Sent to printer</p>
          )}
        </div>
        <Modal
          open={showConnect}
          onClose={() => setShowConnect(false)}
          eyebrow="Printer Setup"
          title="Connect Receipt Printer"
          subtitle="Pick a connection type below. We recommend Bluetooth for mobile and USB for desktop counters."
          size="md"
          footer={(
            <>
              <button type="button" className="roles-cancel-btn" onClick={() => setShowConnect(false)}>
                Close
              </button>
              <button
                type="button"
                className="roles-save-btn"
                onClick={() => { setShowConnect(false); handlePrint(); }}
                disabled={printBusy || cart.length === 0}
              >
                {printBusy ? 'Printing…' : 'Print Test / Browser'}
              </button>
            </>
          )}
        >
          <div className="pos-printer-modal">
            <div className="pos-printer-status-card">
              <p className="eyebrow">Current Status</p>
              <p className="pos-printer-status-main">
                {printer.type === 'none' ? 'Not Connected' : `Connected · ${printer.name}`}
              </p>
              {printer.type !== 'none' && (
                <p className="pos-printer-status-sub">
                  Active via {printer.type === 'bluetooth' ? 'Bluetooth' : 'USB'}
                </p>
              )}
            </div>
            <div className="pos-printer-options">
              {!isIosDevice() && printerEnv.canUseBluetooth && (
                <button
                  type="button"
                  className="pos-printer-option-btn"
                  onClick={handleConnectBluetooth}
                  disabled={printBusy}
                >
                  <strong>Bluetooth Printer</strong>
                  <span>Recommended for tablets and Android phones</span>
                </button>
              )}
              {!isIosDevice() && printerEnv.usbAvailable && printerEnv.platform !== 'ios' && (
                <button
                  type="button"
                  className="pos-printer-option-btn"
                  onClick={handleConnectUSB}
                  disabled={printBusy}
                >
                  <strong>USB Printer</strong>
                  <span>Best for fixed cashier stations</span>
                </button>
              )}
              <button
                type="button"
                className="pos-printer-option-btn"
                onClick={() => { setShowConnect(false); handlePrint(); }}
                disabled={printBusy || cart.length === 0}
              >
                <strong>{isIosDevice() ? 'AirPrint / Share' : 'Browser Print Dialog'}</strong>
                <span>Use system print if direct hardware connect is unavailable</span>
              </button>
            </div>
            {printer.type !== 'none' && (
              <button type="button" className="pos-printer-remove-btn" onClick={handleDisconnect}>
                Disconnect Current Printer
              </button>
            )}
          </div>
        </Modal>

        <header className="pos-order-head">
          <div>
            <p className="eyebrow">Active Check</p>
            <button type="button" className="btn-outline" style={{ marginBottom: 6 }} onClick={() => setProfileOpen(true)}>
              Restaurant Profile
            </button>
            <select
              value={selectedTable}
              onChange={e => handleTableChange(e.target.value)}
              disabled={isPaid}
              style={{
                background: 'transparent', color: 'var(--text1)',
                border: 'none', fontSize: 18, fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              <option value="">— No table —</option>
              {tables
                .filter(t => t.status === 'empty' || t.status === 'occupied' || t.status === 'paying')
                .map(t => (
                  <option key={t.id} value={t.id}>{t.name} · {t.status}</option>
                ))}
            </select>
            <p className="pos-meta">
              {tableObj ? `${tableObj.covers} guests` : '—'} ·{' '}
              <span className="mono">
                {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          </div>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </header>

        {/* Note display */}
        {note && !noteOpen && (
          <p className="pos-note" onClick={() => setNoteOpen(true)} style={{ cursor: 'pointer' }}>
            📝 {note}
          </p>
        )}

        {/* Inline note editor */}
        {noteOpen && (
          <div className="pos-note-editor">
            <input
              ref={noteRef}
              className="roles-input"
              placeholder="Special instructions, allergies…"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Escape') setNoteOpen(false);
              }}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              type="button"
              className="roles-save-btn sm"
              onClick={() => setNoteOpen(false)}
            >✓</button>
          </div>
        )}

        {error && <p style={{ color: 'var(--danger)', fontSize: 12, margin: '4px 0' }}>{error}</p>}

        {/* Cart items */}
        <ul className="pos-items">
          {cart.map(c => (
            <li key={c.menuItem.id} className="pos-item">
              <span className="pos-item-qty mono">{c.qty}</span>
              <div className="pos-item-body">
                <div className="pos-item-row">
                  <span>{c.menuItem.name}</span>
                  <span className="mono">${(c.menuItem.price * c.qty).toFixed(2)}</span>
                </div>
                {c.mods.map(m => <p key={m} className="pos-mod">· {m}</p>)}
                {!isPaid && payState !== 'sent' && (
                  <div className="pos-qty-btns">
                    <button type="button" onClick={() => changeQty(c.menuItem.id, -1)}>−</button>
                    <button type="button" onClick={() => changeQty(c.menuItem.id, +1)}>+</button>
                  </div>
                )}
              </div>
            </li>
          ))}
          {cart.length === 0 && (
            <p style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
              Add items from the menu.
            </p>
          )}
        </ul>

        {/* Sent banner */}
        {payState === 'sent' && (
          <p style={{ fontSize: 12, color: 'var(--success, #4ade80)', padding: '6px 0', borderTop: '0.5px solid var(--line)' }}>
            ✓ Sent to kitchen — awaiting payment
          </p>
        )}

        {/* Extras: note / split / print */}
        {!isPaid && payState !== 'sent' && (
          <div className="pos-extras">
            <button type="button" className="btn-outline"
              onClick={() => setNoteOpen(o => !o)}>
              {note ? '✏ Edit note' : '+ Note'}
            </button>
            <button type="button"
              className={`btn-outline ${splitMode ? 'active' : ''}`}
              onClick={() => setSplitMode(s => !s)}>
              {splitMode ? 'Split · 2' : 'Split'}
            </button>
            <button type="button"
              className="btn-outline"
              disabled={cart.length === 0 || printBusy}
              onClick={() => handlePrint()}
              title={printer.type !== 'none' ? `Print via ${printer.name}` : 'Print via browser dialog'}
            >
              {printBusy ? '…' : '🖨'}
            </button>
          </div>
        )}

        {/* Totals */}
        <footer className="pos-totals">
          <div className="pos-total-row"><span>Subtotal</span><span className="mono">${subtotal.toFixed(2)}</span></div>
          <div className="pos-total-row"><span>Service · {serviceRate.toFixed(2)}%</span><span className="mono">${service.toFixed(2)}</span></div>
          {taxIncluded && (
            <div className="pos-total-row">
              <span>Amount before {taxType}</span>
              <span className="mono">${preTaxTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="pos-total-row">
            <span>{taxType} · {taxRate.toFixed(2)}%{taxIncluded ? ' (included)' : ''}</span>
            <span className="mono">${tax.toFixed(2)}</span>
          </div>
          <div className="pos-total-final"><span>Total Due</span><span className="serif">${total.toFixed(2)}</span></div>

          {/* New Check button — shown after payment is finalised */}
          {isPaid ? (
            <>
              <button
                type="button"
                className="pos-print-receipt"
                disabled={printBusy}
                onClick={() => handlePrint(
                  payState === 'card' ? 'Card' : payState === 'cash' ? 'Cash' : payState === 'comped' ? 'Complimentary' : undefined
                )}
              >
                {printBusy ? '…' : '🖨 Print Receipt'}
              </button>
              <button type="button" className="pos-charge done" onClick={resetCheck}>
                ✓ Done · New Check
              </button>
            </>
          ) : (
            <>
              <button type="button"
                className={`pos-charge ${payState === 'sent' ? 'sent' : ''}`}
                disabled={cart.length === 0 || busy}
                onClick={() => handleCharge('card')}
              >
                {busy ? '…' : `💳 Charge · $${total.toFixed(2)}`}
              </button>

              <div className="pos-alt-pay">
                <button type="button"
                  disabled={cart.length === 0 || busy}
                  onClick={() => handleCharge('cash')}>
                  💵 Cash
                </button>
                <button type="button"
                  disabled={cart.length === 0 || busy || payState === 'sent'}
                  onClick={handleSend}>
                  🧾 {payState === 'sent' ? 'Sent ✓' : 'Send'}
                </button>
                <button type="button"
                  disabled={cart.length === 0 || busy}
                  onClick={handleComp}>
                  🎁 Comp
                </button>
              </div>
            </>
          )}
        </footer>
      </aside>
      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        eyebrow="Restaurant Profile"
        title="Brand, billing & contact"
        subtitle="Staff share contact details from the server. Logo is uploaded in Manager → Restaurant Profile."
        size="lg"
        footer={
          <>
            <button type="button" className="roles-cancel-btn" onClick={() => setProfileOpen(false)}>Cancel</button>
            <button type="button" className="roles-save-btn" onClick={saveProfile} disabled={profileBusy || !profileDraft.name.trim()}>
              {profileBusy ? 'Saving…' : 'Save Profile'}
            </button>
          </>
        }
      >
        <div className="form-grid-2">
          <input className="roles-input" placeholder="Restaurant name" value={profileDraft.name} onChange={e => setProfileDraft(d => ({ ...d, name: e.target.value }))} />
          <input className="roles-input" placeholder="Contact phone" value={profileDraft.contact_phone} onChange={e => setProfileDraft(d => ({ ...d, contact_phone: e.target.value }))} />
          <input className="roles-input" placeholder="Contact email" value={profileDraft.contact_email} onChange={e => setProfileDraft(d => ({ ...d, contact_email: e.target.value }))} />
          <input className="roles-input" placeholder="Address line 1" value={profileDraft.address_line1} onChange={e => setProfileDraft(d => ({ ...d, address_line1: e.target.value }))} />
          <input className="roles-input" placeholder="Address line 2" value={profileDraft.address_line2} onChange={e => setProfileDraft(d => ({ ...d, address_line2: e.target.value }))} />
          <input className="roles-input" placeholder="City" value={profileDraft.city} onChange={e => setProfileDraft(d => ({ ...d, city: e.target.value }))} />
          <input className="roles-input" placeholder="Country" value={profileDraft.country} onChange={e => setProfileDraft(d => ({ ...d, country: e.target.value }))} />
          <input className="roles-input" placeholder="Postal code" value={profileDraft.postal_code} onChange={e => setProfileDraft(d => ({ ...d, postal_code: e.target.value }))} />
          <input className="roles-input" placeholder="Tax ID" value={profileDraft.tax_id} onChange={e => setProfileDraft(d => ({ ...d, tax_id: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
