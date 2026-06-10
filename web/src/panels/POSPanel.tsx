import { useState, useEffect, useCallback, useRef } from 'react';
import { menuApi, menuCategoriesApi, ordersApi, restaurantApi, tablesApi, type ApiMenuCategory, type ApiMenuItem, type ApiOrder, type ApiRestaurant, type ApiTable } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  autoReconnectBluetooth, connectBluetooth, connectUSB, disconnectPrinter, printerChannels, printerStatus, print as printReceipt, printKitchenTicket, printTest,
  type ReceiptData,
  type PrintChannel,
} from '../services/PrintService';
import { PrinterHelpBanner } from '../components/PrinterHelpBanner';
import { BluetoothIcon } from '../components/BluetoothIcon';
import { getPrinterEnvironment, isIosDevice } from '../services/printerEnvironment';
import { getRestaurantLogo, syncRestaurantLogoCache } from '../services/restaurantLogoStorage';
import { buildMenuCategoryTabs, defaultCategorySlug } from '../utils/menuCategories';
import { MenuItemImage } from '../components/MenuItemImage';
import { SearchSelect } from '../components/SearchSelect';
import { Modal } from '../components/Modal';
import { toastBus } from '../services/toastBus';
import { formatMoney, getCurrencySymbol } from '../utils/currency';
import './POSPanel.css';

type CartItem     = { menuItem: ApiMenuItem; qty: number; mods: string[]; orderItemId?: string; addedNow?: boolean };
type PaymentState = 'open' | 'sent' | 'card' | 'cash' | 'comped';
type PrinterRole = 'kitchen' | 'cashier';
type AssignedPrinter = { role: PrinterRole; channel: Extract<PrintChannel, 'bluetooth' | 'usb'>; name: string };

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
  const [pendingOrders, setPendingOrders] = useState<ApiOrder[]>([]);
  const [busy,          setBusy]          = useState(false);
  const [editMode,      setEditMode]      = useState(false);
  const [parcel,        setParcel]        = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(true);
  const [tableOrderLoading, setTableOrderLoading] = useState(false);
  const [restaurant,    setRestaurant]    = useState<ApiRestaurant | null>(null);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [profileBusy,   setProfileBusy]   = useState(false);
  const [profileDraft,  setProfileDraft]  = useState({
    name: '', contact_phone: '', contact_email: '',
    address_line1: '', address_line2: '', city: '', country: '', postal_code: '', tax_id: '',
  });

  // ── Printer state ──────────────────────────────────────────────────────────
  const [printer,      setPrinter]      = useState<{ type: 'none' | 'bluetooth' | 'usb'; name: string }>({ type: 'none', name: '' });
  const [printBusy,    setPrintBusy]    = useState(false);
  const [printError,   setPrintError]   = useState('');
  const [printOk,      setPrintOk]      = useState(false);
  const [printerSetupOpen, setPrinterSetupOpen] = useState(false);
  const [connectTarget, setConnectTarget] = useState<PrinterRole>('cashier');
  const [kitchenPrinter, setKitchenPrinter] = useState<AssignedPrinter | null>(null);
  const [cashierPrinter, setCashierPrinter] = useState<AssignedPrinter | null>(null);
  const lastConnectToastKeyRef = useRef('');

  // Sync printer status on mount (in case a previous session still has a device)
  useEffect(() => {
    setPrinter(printerStatus());
    void autoReconnectBluetooth().then((result) => {
      if (!result.connected) return;
      setPrinter({ type: 'bluetooth', name: result.name || 'Bluetooth Printer' });
    });
  }, []);

  async function assignPrinter(role: PrinterRole, channel: Extract<PrintChannel, 'bluetooth' | 'usb'>, name: string) {
    const other = role === 'kitchen' ? cashierPrinter : kitchenPrinter;
    if (other && other.channel === channel) {
      throw new Error(`"${other.name}" is already assigned to ${other.role}. Use a different connection type for ${role}.`);
    }
    const assigned: AssignedPrinter = { role, channel, name };
    if (role === 'kitchen') {
      setKitchenPrinter(assigned);
      const updated = await restaurantApi.update({ kitchen_printer: { role: 'kitchen', channel, name } });
      setRestaurant(updated);
    } else {
      setCashierPrinter(assigned);
      const updated = await restaurantApi.update({ cashier_printer: { role: 'cashier', channel, name } });
      setRestaurant(updated);
    }
  }

  function printerBadgeText(target: PrinterRole) {
    const assigned = target === 'kitchen' ? kitchenPrinter : cashierPrinter;
    if (!assigned) return 'Not configured';
    const channelLive = printerChannels();
    const isConnected = assigned.channel === 'bluetooth' ? channelLive.bluetooth : channelLive.usb;
    return `${isConnected ? 'Connected' : 'Configured'} · ${assigned.name} (${assigned.channel.toUpperCase()})`;
  }

  useEffect(() => {
    Promise.all([menuApi.list(), menuCategoriesApi.list(), tablesApi.list(), restaurantApi.me()])
      .then(([m, cats, t, r]) => {
        setMenu(m);
        setCategories(cats);
        setCat(defaultCategorySlug(cats));
        setTables(t);
        setRestaurant(r);
        setKitchenPrinter(r.kitchen_printer ?? null);
        setCashierPrinter(r.cashier_printer ?? null);
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

  const refreshBillingQueues = useCallback(async () => {
    try {
      const [rows, tableRows] = await Promise.all([
        ordersApi.list({ status: 'sent' }),
        tablesApi.list(),
      ]);
      setPendingOrders(rows);
      setTables(tableRows);
    } catch {
      setPendingOrders([]);
    }
  }, []);

  // Billing queue: list sent orders + table status for cashier.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!alive) return;
      await refreshBillingQueues();
    };
    load();
    const t = window.setInterval(load, 5000);
    const onOrderSent = () => { void refreshBillingQueues(); };
    window.addEventListener('CAFYZ_ORDER_SENT', onOrderSent as EventListener);
    return () => {
      alive = false;
      window.clearInterval(t);
      window.removeEventListener('CAFYZ_ORDER_SENT', onOrderSent as EventListener);
    };
  }, [refreshBillingQueues]);

  // Cross-device sync from backend printer registry.
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const r = await restaurantApi.me();
        if (!alive) return;
        setKitchenPrinter(r.kitchen_printer ?? null);
        setCashierPrinter(r.cashier_printer ?? null);
      } catch {
        // keep existing state during transient sync errors
      }
    };
    const t = window.setInterval(sync, 6000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const categorised = buildMenuCategoryTabs(categories, menu);

  const visible = menu
    .filter(m => cat === 'all' || m.category === cat)
    .filter(m => !search.trim() ||
      m.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      m.description?.toLowerCase().includes(search.trim().toLowerCase()));

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
  const currencyCode = restaurant?.currency_code;

  const isPaid   = payState === 'card' || payState === 'cash' || payState === 'comped';
  // The bill can be edited (add products, change qty) only while it is a pending
  // kitchen-sent order that hasn't been paid yet.
  const canEditBill = payState === 'sent' && !!activeOrderId && !isPaid;
  const additionsCount = cart.filter(c => c.addedNow).reduce((s, c) => s + c.qty, 0);
  const hasAdditions = additionsCount > 0;
  const statusLabel = payState === 'card'  ? 'Paid · Card'
    : payState === 'cash'  ? 'Paid · Cash'
    : payState === 'sent'  ? 'Sent to Kitchen'
    : payState === 'comped'? 'Comped'
    : 'Open';
  const statusClass = isPaid || payState === 'sent' ? 'badge-paid' : 'badge-pending';

  // ── Reset check ────────────────────────────────────────────────────────────
  function resetCheck() {
    setCart([]);
    setSelectedTable('');
    setActiveOrderId(null);
    setPayState('open');
    setNote('');
    setError('');
    setEditMode(false);
    setParcel(false);
    setPrintOk(false);
    setPrintError('');
  }

  // When table selection changes, reset the order state (keep cart)
  async function handleTableChange(tableId: string) {
    setSelectedTable(tableId);
    setActiveOrderId(null);
    setPayState('open');
    setEditMode(false);
    setParcel(false);
    setError('');
    if (!tableId) {
      setCart([]);
      setNote('');
      return;
    }
    setTableOrderLoading(true);
    try {
      const orders = await ordersApi.list({ table_id: tableId });
      const pending = orders.find((o) => o.status === 'sent');
      // Self-heal: if the table is already empty/cleared but a stale 'sent' order
      // still lingers from a previous customer, settle it silently so it stops
      // re-appearing — then show this table as having no active bill.
      const tableStatus = tables.find((t) => t.id === tableId)?.status;
      if (pending && tableStatus === 'empty') {
        try { await ordersApi.settleTable(tableId); } catch { /* best effort */ }
        setCart([]);
        setNote('');
        setError('No pending kitchen-sent bill for this table.');
        return;
      }
      if (!pending) {
        setCart([]);
        setNote('');
        setError('No pending kitchen-sent bill for this table.');
        return;
      }
      const full = await ordersApi.get(pending.id);
      const nextCart: CartItem[] = (full.items ?? []).map((it) => {
        const fromMenu = menu.find((m) => m.id === it.menu_item_id);
        const fallback: ApiMenuItem = fromMenu ?? {
          id: it.menu_item_id,
          restaurant_id: user?.restaurant_id ?? '',
          name: it.name ?? 'Item',
          category: 'mains',
          price: Number(it.price ?? 0),
          description: '',
          symbol: '○',
          is_popular: 0,
          is_available: 1,
        };
        let mods: string[] = [];
        if (typeof it.mods === 'string') {
          try { mods = JSON.parse(it.mods || '[]'); } catch { mods = []; }
        } else {
          mods = (it.mods as string[] | undefined) ?? [];
        }
        return { menuItem: fallback, qty: it.qty, mods, orderItemId: it.id };
      });
      setCart(nextCart);
      setActiveOrderId(full.id);
      setNote(full.note ?? '');
      setParcel(full.order_type === 'parcel');
      setPayState('sent');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTableOrderLoading(false);
    }
  }

  // ── Charge (card / cash) ───────────────────────────────────────────────────
  async function handleCharge(method: 'card' | 'cash') {
    if (!activeOrderId || cart.length === 0 || isPaid || payState !== 'sent') {
      setError('Select a pending table bill first.');
      return;
    }
    setBusy(true); setError('');
    try {
      if (selectedTable) {
        // Atomic, server-side: marks EVERY active order on the table paid and
        // clears the table in one transaction — so no leftover 'sent' order can
        // survive to re-appear on the now-empty table.
        await ordersApi.settleTable(selectedTable);
      } else {
        // Takeaway / no table: just settle the single active order.
        await ordersApi.updateStatus(activeOrderId, 'paid');
      }
      setPayState(method);
      setActiveOrderId(null);
      await refreshBillingQueues();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  // ── Bill editing (pending kitchen-sent order) ──────────────────────────────
  // Change a line's quantity; dropping below 1 removes it. Persists to the order
  // and reverts the optimistic update if the server call fails.
  async function editQty(index: number, delta: number) {
    const item = cart[index];
    if (!activeOrderId || !item?.orderItemId || busy) return;
    const newQty = item.qty + delta;
    if (newQty < 1) { await removeLine(index); return; }
    const prev = cart;
    setCart(cs => cs.map((c, i) => (i === index ? { ...c, qty: newQty } : c)));
    try {
      await ordersApi.updateItem(activeOrderId, item.orderItemId, { qty: newQty });
    } catch (e) {
      setCart(prev);
      setError((e as Error).message);
    }
  }

  async function removeLine(index: number) {
    const item = cart[index];
    if (!activeOrderId || !item?.orderItemId || busy) return;
    const prev = cart;
    setCart(cs => cs.filter((_, i) => i !== index));
    try {
      await ordersApi.deleteItem(activeOrderId, item.orderItemId);
    } catch (e) {
      setCart(prev);
      setError((e as Error).message);
    }
  }

  // Add a product to the active bill (customer ordered more). Increments the
  // line if the item is already present, otherwise creates a new order item.
  async function addProduct(menuItem: ApiMenuItem) {
    if (!canEditBill || busy) return;
    const existing = cart.findIndex(c => c.menuItem.id === menuItem.id && c.mods.length === 0);
    if (existing >= 0 && cart[existing].orderItemId) {
      await editQty(existing, 1);
      setCart(cs => cs.map((c, i) => (i === existing ? { ...c, addedNow: true } : c)));
      return;
    }
    setBusy(true); setError('');
    try {
      const created = await ordersApi.addItem(activeOrderId!, { menu_item_id: menuItem.id, qty: 1, mods: [] });
      setCart(cs => [...cs, { menuItem, qty: 1, mods: [], orderItemId: created.id, addedNow: true }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Print just the newly-added items to the kitchen (supplementary ticket).
  async function fireAdditionsToKitchen() {
    const additions = cart.filter(c => c.addedNow);
    if (!additions.length || busy) return;
    setBusy(true); setError('');
    try {
      await printKitchenTicket({
        restaurantName: restaurant?.name || user?.restaurant_name || 'Restaurant',
        ticketId: `add-${(activeOrderId ?? '').slice(0, 8)}-${Date.now()}`,
        tableName: tableObj?.name ?? selectedTable,
        serverName: user?.name,
        covers: tableObj?.covers || undefined,
        items: additions.map(c => ({ name: c.menuItem.name, qty: c.qty })),
        note: 'ADDITIONAL ITEMS',
      }, user?.restaurant_id ?? restaurant?.id, { channel: kitchenPrinter?.channel });
      setCart(cs => cs.map(c => ({ ...c, addedNow: false })));
      toastBus.success('Added items sent to kitchen.');
    } catch (e) {
      setError((e as Error).message);
      toastBus.error(`Could not send additions to kitchen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // Toggle the active bill between dine-in and parcel/takeaway (persisted).
  async function toggleParcel() {
    if (!activeOrderId || busy) return;
    const next = !parcel;
    setParcel(next);
    try {
      await ordersApi.update(activeOrderId, { order_type: next ? 'parcel' : 'dine_in' });
    } catch (e) {
      setParcel(!next);
      setError((e as Error).message);
    }
  }

  // ── Printer helpers ────────────────────────────────────────────────────────
  async function handleConnectBluetooth() {
    setPrintBusy(true); setPrintError('');
    try {
      const name = await connectBluetooth();
      setPrinter({ type: 'bluetooth', name });
      await assignPrinter(connectTarget, 'bluetooth', name);
      const toastKey = `${connectTarget}:bluetooth:${name.toLowerCase()}`;
      if (lastConnectToastKeyRef.current !== toastKey) {
        lastConnectToastKeyRef.current = toastKey;
        toastBus.success(`${connectTarget === 'kitchen' ? 'Kitchen' : 'Cashier'} printer connected: ${name}`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setPrintError(msg);
      toastBus.error(`Bluetooth connection failed: ${msg}`);
    }
    finally { setPrintBusy(false); }
  }

  async function handleConnectUSB() {
    setPrintBusy(true); setPrintError('');
    try {
      const name = await connectUSB();
      setPrinter({ type: 'usb', name });
      await assignPrinter(connectTarget, 'usb', name);
      const toastKey = `${connectTarget}:usb:${name.toLowerCase()}`;
      if (lastConnectToastKeyRef.current !== toastKey) {
        lastConnectToastKeyRef.current = toastKey;
        toastBus.success(`${connectTarget === 'kitchen' ? 'Kitchen' : 'Cashier'} printer connected: ${name}`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setPrintError(msg);
      toastBus.error(`USB connection failed: ${msg}`);
    }
    finally { setPrintBusy(false); }
  }

  function handleDisconnect() {
    disconnectPrinter();
    setPrinter({ type: 'none', name: '' });
    toastBus.info('Printer disconnected.');
  }

  function buildReceiptData(payMethod?: string): ReceiptData {
    const address = [restaurant?.address_line1, restaurant?.address_line2, restaurant?.city, restaurant?.postal_code, restaurant?.country]
      .filter(Boolean).join(', ');
    return {
      restaurantName: restaurant?.name || user?.restaurant_name || 'Restaurant',
      currencySymbol: getCurrencySymbol(currencyCode),
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
      const cashierChannel = cashierPrinter?.channel;
      const method = await printReceipt(
        buildReceiptData(payMethod),
        undefined,
        32,
        user?.restaurant_id ?? restaurant?.id,
        cashierChannel ? { channel: cashierChannel } : undefined,
      );
      setPrintOk(true);
      toastBus.success(
        method === 'dialog'
          ? 'Receipt opened in print preview.'
          : `Receipt printed via ${method}.`,
      );
      if (method !== 'dialog') {
        setTimeout(() => setPrintOk(false), 3000);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setPrintError(msg);
      toastBus.error(`Receipt print failed: ${msg}`);
    }
    finally { setPrintBusy(false); }
  }

  async function checkKitchenPrinter() {
    setPrintBusy(true);
    setPrintError('');
    try {
      if (!kitchenPrinter) throw new Error('Kitchen printer is not configured. Connect it first.');
      const method = await printKitchenTicket({
        restaurantName: restaurant?.name || user?.restaurant_name || 'Restaurant',
        ticketId: `kds-check-${Date.now()}`,
        tableName: tableObj?.name || 'POS-TEST',
        serverName: user?.name || 'Cafyz',
        covers: 2,
        station: 'EXPEDITE',
        items: [
          { name: 'Kitchen Printer Check', qty: 1, mods: ['From POS'] },
          { name: 'Line Test Item', qty: 1, alert: true },
        ],
        note: 'Kitchen connection test from POS',
      }, user?.restaurant_id ?? restaurant?.id, { channel: kitchenPrinter.channel });
      toastBus.success(
        method === 'dialog'
          ? 'Kitchen printer check opened in print preview.'
          : `Kitchen printer check sent via ${method}.`,
      );
    } catch (e) {
      const msg = (e as Error).message;
      setPrintError(msg);
      toastBus.error(`Kitchen printer check failed: ${msg}`);
      throw e;
    } finally {
      setPrintBusy(false);
    }
  }

  async function checkCashierPrinter() {
    setPrintBusy(true);
    setPrintError('');
    try {
      if (!cashierPrinter) throw new Error('Cashier printer is not configured. Connect it first.');
      const method = await printTest({
        restaurantName: restaurant?.name || user?.restaurant_name || 'Restaurant',
        restaurantId: user?.restaurant_id ?? restaurant?.id,
        logoUrl: getRestaurantLogo(user?.restaurant_id ?? restaurant?.id, restaurant?.logo_url),
        addressLine: [restaurant?.address_line1, restaurant?.city, restaurant?.country].filter(Boolean).join(', ') || undefined,
        phone: restaurant?.contact_phone || undefined,
      }, { channel: cashierPrinter.channel });
      toastBus.success(
        method === 'dialog'
          ? 'Cashier printer check opened in print preview.'
          : `Cashier printer check sent via ${method}.`,
      );
    } catch (e) {
      const msg = (e as Error).message;
      setPrintError(msg);
      toastBus.error(`Cashier printer check failed: ${msg}`);
      throw e;
    } finally {
      setPrintBusy(false);
    }
  }

  async function checkBothPrinters() {
    setPrintBusy(true);
    setPrintError('');
    try {
      if (!kitchenPrinter || !cashierPrinter) {
        throw new Error('Configure both Kitchen and Cashier printers first.');
      }
      if (kitchenPrinter.channel === cashierPrinter.channel) {
        throw new Error('Kitchen and Cashier printers must use different connection channels.');
      }
      const kitchenMethod = await printKitchenTicket({
        restaurantName: restaurant?.name || user?.restaurant_name || 'Restaurant',
        ticketId: `both-check-${Date.now()}`,
        tableName: tableObj?.name || 'POS-TEST',
        serverName: user?.name || 'Cafyz',
        covers: 2,
        station: 'EXPEDITE',
        items: [{ name: 'Dual test · kitchen', qty: 1 }],
      }, user?.restaurant_id ?? restaurant?.id, { channel: kitchenPrinter.channel });

      const cashierMethod = await printTest({
        restaurantName: restaurant?.name || user?.restaurant_name || 'Restaurant',
        restaurantId: user?.restaurant_id ?? restaurant?.id,
        logoUrl: getRestaurantLogo(user?.restaurant_id ?? restaurant?.id, restaurant?.logo_url),
      }, { channel: cashierPrinter.channel });

      toastBus.success(
        `Both checks complete · Kitchen: ${kitchenMethod} · Cashier: ${cashierMethod}`,
        4200,
      );
    } catch (e) {
      const msg = (e as Error).message;
      setPrintError(msg);
      toastBus.error(`Dual printer check failed: ${msg}`);
    } finally {
      setPrintBusy(false);
    }
  }

  if (loading) return (
    <div className="pos-layout">
      <p style={{ color: 'var(--text2)', padding: 32 }}>Loading billing…</p>
    </div>
  );

  return (
    <div className="pos-layout">

      {/* ── Billing lookup panel ──────────────────────────────────────── */}
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

        {canEditBill && editMode && (
          <p className="pos-add-hint">✎ Editing bill — tap a dish to add it to {tableObj?.name ?? 'this table'}.</p>
        )}
        <div className="pos-dishes">
          {visible.map(d => {
            const addable = canEditBill && editMode;
            return (
              <div
                key={d.id}
                className={`pos-dish card ${addable ? 'addable' : 'disabled'}`}
                {...(addable
                  ? { role: 'button', tabIndex: 0, onClick: () => { void addProduct(d); } }
                  : {})}
              >
                <div className="pos-dish-plate">
                  <MenuItemImage imageUrl={d.image_url} name={d.name} variant="pos-plate" />
                  {d.is_popular === 1 && <span className="pos-popular">★ Popular</span>}
                  {addable && <span className="pos-dish-add">+ Add</span>}
                </div>
                <div className="pos-dish-info">
                  <p className="pos-dish-name">{d.name}</p>
                  <p className="pos-dish-price mono">{formatMoney(d.price, currencyCode)}</p>
                  <p className="pos-dish-sub">{d.description}</p>
                </div>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p style={{ color: 'var(--text3)', padding: 24, gridColumn: '1/-1' }}>
              {search ? `No results for "${search}"` : 'No items in this category.'}
            </p>
          )}
        </div>
        <div style={{ padding: 10, borderTop: '0.5px solid var(--line)', marginTop: 10 }}>
          <p className="eyebrow">Pending Table Bills</p>
          {pendingOrders.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text3)', fontSize: 12 }}>No pending table bills.</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {pendingOrders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="pos-pill"
                  onClick={() => { if (o.table_id) void handleTableChange(o.table_id); }}
                >
                  {o.table_name || 'No table'}
                </button>
              ))}
            </div>
          )}
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text3)' }}>
          Billing-only mode: orders are created and sent from Menu/Waiter panels.
        </p>
      </section>

      {/* ── Order sidebar ──────────────────────────────────────────────── */}
      <aside className="pos-order">

        {/* ── Printer status bar ─────────────────────────────────────────── */}
        <div className="pos-printer-bar">
          <PrinterHelpBanner />
          <div className="pos-printer-bar-row">
            {printer.type !== 'none' ? (
              <span className="pos-printer-connected">
                {printer.type === 'bluetooth' ? <BluetoothIcon /> : '🔌'} {printer.name}
                <button type="button" className="pos-printer-disconnect" onClick={handleDisconnect}>×</button>
              </span>
            ) : (
              <span className="pos-printer-idle">No printer connected</span>
            )}
            <button type="button" className="pos-printer-trigger" onClick={handleDisconnect} disabled={printBusy || printer.type === 'none'}>
              Disconnect Active
            </button>
          </div>
          <button
            type="button"
            className={`pos-printer-dropdown-toggle ${printerSetupOpen ? 'open' : ''}`}
            onClick={() => setPrinterSetupOpen((v) => !v)}
            aria-expanded={printerSetupOpen}
            aria-controls="pos-printer-setup-dropdown"
          >
            <span>Printer Configuration Setup</span>
            <span className="mono">{printerSetupOpen ? '▲' : '▼'}</span>
          </button>

          <div id="pos-printer-setup-dropdown" className={`pos-printer-dropdown ${printerSetupOpen ? 'open' : ''}`}>
            <div className="pos-printer-assignment-grid">
              <button
                type="button"
                className="pos-printer-assignment"
                onClick={() => setConnectTarget('kitchen')}
                disabled={printBusy}
              >
                <span className="pos-printer-assignment-title">Kitchen Printer</span>
                <span className="pos-printer-assignment-meta">{printerBadgeText('kitchen')}</span>
              </button>
              <button
                type="button"
                className="pos-printer-assignment"
                onClick={() => setConnectTarget('cashier')}
                disabled={printBusy}
              >
                <span className="pos-printer-assignment-title">Cashier Printer</span>
                <span className="pos-printer-assignment-meta">{printerBadgeText('cashier')}</span>
              </button>
            </div>

            {printError && (
              <p className="pos-printer-error">{printError}</p>
            )}
            {printOk && (
              <p className="pos-printer-ok">✓ Sent to printer</p>
            )}
            <div className="pos-printer-config-inline">
              <p className="eyebrow">Bluetooth / USB Configuration</p>
              <div className="pos-printer-role-toggle">
                <button
                  type="button"
                  className={`pos-printer-role-btn ${connectTarget === 'kitchen' ? 'active' : ''}`}
                  onClick={() => setConnectTarget('kitchen')}
                  disabled={printBusy}
                >
                  Kitchen
                </button>
                <button
                  type="button"
                  className={`pos-printer-role-btn ${connectTarget === 'cashier' ? 'active' : ''}`}
                  onClick={() => setConnectTarget('cashier')}
                  disabled={printBusy}
                >
                  Cashier
                </button>
              </div>
              <div className="pos-printer-inline-actions">
                {!isIosDevice() && printerEnv.canUseBluetooth && (
                  <button type="button" className="pos-printer-check-btn" onClick={handleConnectBluetooth} disabled={printBusy}>
                    {printBusy ? '…' : <><BluetoothIcon /> Connect {connectTarget} Bluetooth</>}
                  </button>
                )}
                {!isIosDevice() && printerEnv.usbAvailable && printerEnv.platform !== 'ios' && (
                  <button type="button" className="pos-printer-check-btn" onClick={handleConnectUSB} disabled={printBusy}>
                    {printBusy ? '…' : `Connect ${connectTarget} USB`}
                  </button>
                )}
              </div>
            </div>
            <div className="pos-printer-checks">
              <button type="button" className="pos-printer-check-btn" onClick={checkKitchenPrinter} disabled={printBusy}>
                {printBusy ? '…' : 'Kitchen Printer Check'}
              </button>
              <button type="button" className="pos-printer-check-btn" onClick={checkCashierPrinter} disabled={printBusy}>
                {printBusy ? '…' : 'Cashier Printer Check'}
              </button>
              <button type="button" className="pos-printer-check-btn both" onClick={checkBothPrinters} disabled={printBusy}>
                {printBusy ? '…' : 'One Click Check Both'}
              </button>
            </div>
          </div>
        </div>

        <header className="pos-order-head">
          <div className="pos-check-info">
            <div className="pos-check-top">
              <p className="eyebrow">Active Check</p>
              <span className={`badge ${statusClass}`}>{statusLabel}</span>
            </div>
            <SearchSelect
              value={selectedTable}
              disabled={isPaid}
              placeholder="— Select table —"
              searchPlaceholder="Search tables…"
              ariaLabel="Select table"
              onChange={(v) => { void handleTableChange(v); }}
              options={[
                { value: '', label: '— No table —' },
                ...tables
                  .filter(t => t.status === 'empty' || t.status === 'occupied' || t.status === 'paying')
                  .map(t => ({ value: t.id, label: `${t.name} · ${t.status}` })),
              ]}
            />
            <p className="pos-meta">
              {tableObj ? `${tableObj.covers} guests` : '—'} ·{' '}
              <span className="mono">
                {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
            {tableOrderLoading && (
              <p className="pos-loading-note">Loading pending order for table…</p>
            )}
            <button type="button" className="btn-outline pos-profile-btn" onClick={() => setProfileOpen(true)}>
              Restaurant Profile
            </button>
          </div>
        </header>

        {note && (
          <p className="pos-note">
            📝 {note}
          </p>
        )}

        {error && <p style={{ color: 'var(--danger)', fontSize: 12, margin: '4px 0' }}>{error}</p>}

        {/* Edit toolbar — only on a pending, unpaid kitchen-sent bill */}
        {canEditBill && (
          <div className="pos-edit-bar">
            <button
              type="button"
              className={`pos-edit-toggle ${editMode ? 'active' : ''}`}
              onClick={() => setEditMode(v => !v)}
            >
              {editMode ? '✓ Done Editing' : '✎ Edit Bill'}
            </button>
            <button
              type="button"
              className={`pos-parcel-toggle${parcel ? ' active' : ''}`}
              aria-pressed={parcel}
              disabled={busy}
              onClick={() => { void toggleParcel(); }}
            >
              {parcel ? '📦 Parcel ✓' : '📦 Parcel / Takeaway'}
            </button>
            {hasAdditions && (
              <button
                type="button"
                className="pos-fire-additions"
                disabled={busy}
                onClick={() => { void fireAdditionsToKitchen(); }}
              >
                🔥 Send {additionsCount} New to Kitchen
              </button>
            )}
          </div>
        )}

        {/* Cart items */}
        <ul className="pos-items">
          {cart.map((c, idx) => (
            <li key={c.orderItemId ?? c.menuItem.id} className={`pos-item ${c.addedNow ? 'added' : ''}`}>
              {canEditBill && editMode ? (
                <div className="pos-item-stepper">
                  <button type="button" onClick={() => { void editQty(idx, -1); }} aria-label="Decrease">−</button>
                  <span className="mono">{c.qty}</span>
                  <button type="button" onClick={() => { void editQty(idx, 1); }} aria-label="Increase">+</button>
                </div>
              ) : (
                <span className="pos-item-qty mono">{c.qty}</span>
              )}
              <div className="pos-item-body">
                <div className="pos-item-row">
                  <span className="pos-item-name">
                    {c.menuItem.name}
                    {c.addedNow && <span className="pos-item-newtag">NEW</span>}
                  </span>
                  <span className="pos-item-price mono">{formatMoney(c.menuItem.price * c.qty, currencyCode)}</span>
                </div>
                {c.mods.map(m => <p key={m} className="pos-mod">· {m}</p>)}
              </div>
              {canEditBill && editMode && (
                <button
                  type="button"
                  className="pos-item-remove"
                  onClick={() => { void removeLine(idx); }}
                  aria-label="Remove item"
                >
                  ×
                </button>
              )}
            </li>
          ))}
          {cart.length === 0 && (
            <p style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>
              Select a pending table to auto-load the bill.
            </p>
          )}
        </ul>

        {/* Sent banner */}
        {payState === 'sent' && (
          <p style={{ fontSize: 12, color: 'var(--success, #4ade80)', padding: '6px 0', borderTop: '0.5px solid var(--line)' }}>
            ✓ Sent to kitchen — awaiting payment
          </p>
        )}

        {/* Totals */}
        <footer className="pos-totals">
          {/* Collapsible price breakdown — Total Due stays always visible below */}
          <button
            type="button"
            className={`pos-breakdown-toggle${breakdownOpen ? ' open' : ''}`}
            aria-expanded={breakdownOpen}
            onClick={() => setBreakdownOpen(v => !v)}
          >
            <span>Price breakdown</span>
            <span className="pos-breakdown-summary mono">{formatMoney(total, currencyCode)}</span>
            <span className="pos-breakdown-chevron" aria-hidden>{breakdownOpen ? '▴' : '▾'}</span>
          </button>

          {breakdownOpen && (
            <div className="pos-breakdown">
              <div className="pos-total-row"><span>Subtotal</span><span className="mono">{formatMoney(subtotal, currencyCode)}</span></div>
              <div className="pos-total-row"><span>Service · {serviceRate.toFixed(2)}%</span><span className="mono">{formatMoney(service, currencyCode)}</span></div>
              {taxIncluded && (
                <div className="pos-total-row">
                  <span>Amount before {taxType}</span>
                  <span className="mono">{formatMoney(preTaxTotal, currencyCode)}</span>
                </div>
              )}
              <div className="pos-total-row">
                <span>{taxType} · {taxRate.toFixed(2)}%{taxIncluded ? ' (incl.)' : ''}</span>
                <span className="mono">{formatMoney(tax, currencyCode)}</span>
              </div>
            </div>
          )}

          <div className="pos-total-final"><span>Total Due</span><span className="serif">{formatMoney(total, currencyCode)}</span></div>

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
                disabled={cart.length === 0 || busy || payState !== 'sent'}
                onClick={() => handleCharge('card')}
              >
                {busy ? '…' : payState === 'sent' ? `💳 Charge · ${getCurrencySymbol(currencyCode)}${total.toFixed(2)}` : 'Select Pending Table'}
              </button>

              <div className="pos-alt-pay">
                <button type="button"
                  disabled={cart.length === 0 || busy || payState !== 'sent'}
                  onClick={() => handleCharge('cash')}>
                  💵 Cash
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
