import { useState, useEffect } from 'react';
import { menuApi, ordersApi, tablesApi, type ApiMenuItem, type ApiTable } from '../services/api';
import './POSPanel.css';

type CartItem = { menuItem: ApiMenuItem; qty: number; mods: string[] };
type PaymentMethod = 'open' | 'card' | 'cash' | 'sent';

const CATS = [
  { id: 'all',      label: 'All',     count: 0 },
  { id: 'starters', label: 'Starters',count: 0 },
  { id: 'mains',    label: 'Mains',   count: 0 },
  { id: 'desserts', label: 'Desserts',count: 0 },
  { id: 'wine',     label: 'Wine',    count: 0 },
  { id: 'drinks',   label: 'Drinks',  count: 0 },
];

export function POSPanel() {
  const [menu,          setMenu]          = useState<ApiMenuItem[]>([]);
  const [tables,        setTables]        = useState<ApiTable[]>([]);
  const [cat,           setCat]           = useState('mains');
  const [cart,          setCart]          = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [compApplied,   setCompApplied]   = useState(false);
  const [splitMode,     setSplitMode]     = useState(false);
  const [payMethod,     setPayMethod]     = useState<PaymentMethod>('open');
  const [note,          setNote]          = useState<string | null>(null);
  const [busy,          setBusy]          = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([menuApi.list(), tablesApi.list()])
      .then(([m, t]) => { setMenu(m); setTables(t); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Categorised view with counts
  const categorised = CATS.map(c => ({
    ...c,
    count: c.id === 'all' ? menu.length : menu.filter(m => m.category === c.id).length,
  }));
  const visible = cat === 'all' ? menu : menu.filter(m => m.category === cat);
  const cartMap  = Object.fromEntries(cart.map(c => [c.menuItem.id, c.qty]));

  function addItem(item: ApiMenuItem) {
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
    setCart(prev => prev.map(c => c.menuItem.id === id ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0));
  }

  const subtotal = cart.reduce((s, c) => s + c.menuItem.price * c.qty, 0);
  const billable = compApplied ? 0 : subtotal;
  const service  = billable * 0.18;
  const tax      = billable * 0.0875;
  const total    = billable + service + tax;

  const statusLabel = payMethod === 'card' ? 'Paid · Card'
    : payMethod === 'cash'  ? 'Paid · Cash'
    : payMethod === 'sent'  ? 'Sent'
    : compApplied ? 'Comped'
    : splitMode   ? 'Split'
    : 'Open';
  const statusClass = payMethod !== 'open' || compApplied ? 'badge-paid' : 'badge-pending';

  // Find the occupied table object
  const tableObj = tables.find(t => t.id === selectedTable);

  async function handleCharge(method: 'card' | 'cash') {
    if (cart.length === 0) return;
    setBusy(true); setError('');
    try {
      // Create order if not already open
      let orderId = activeOrderId;
      if (!orderId) {
        const order = await ordersApi.create({
          table_id: selectedTable || undefined,
          covers: tableObj?.covers || 2,
          note: note || undefined,
        });
        orderId = order.id;
        setActiveOrderId(orderId);
        // Add all cart items
        for (const c of cart) {
          await ordersApi.addItem(orderId, {
            menu_item_id: c.menuItem.id,
            qty: c.qty,
            mods: c.mods,
          });
        }
      }
      // Mark as paid
      await ordersApi.updateStatus(orderId, 'paid');
      if (selectedTable) {
        await tablesApi.updateStatus(selectedTable, { status: 'empty', course: '', covers: 0 });
      }
      setPayMethod(method);
      setActiveOrderId(null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function handleSend() {
    if (cart.length === 0) return;
    setBusy(true); setError('');
    try {
      let orderId = activeOrderId;
      if (!orderId) {
        const order = await ordersApi.create({
          table_id: selectedTable || undefined,
          covers: tableObj?.covers || 2,
        });
        orderId = order.id;
        setActiveOrderId(orderId);
        for (const c of cart) {
          await ordersApi.addItem(orderId, { menu_item_id: c.menuItem.id, qty: c.qty, mods: c.mods });
        }
      }
      await ordersApi.updateStatus(orderId, 'sent');
      if (selectedTable) {
        await tablesApi.updateStatus(selectedTable, { status: 'occupied', course: 'Order sent' });
      }
      setPayMethod('sent');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="pos-layout"><p style={{ color: 'var(--text2)', padding: 32 }}>Loading menu…</p></div>;

  return (
    <div className="pos-layout">
      {/* ── Menu grid ──────────────────────────────────────────────── */}
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
            <input placeholder="Search the menu" />
            <kbd className="mono">⌘K</kbd>
          </div>
        </div>

        <div className="pos-dishes">
          {visible.map(d => (
            <button key={d.id} type="button"
              className={`pos-dish card ${cartMap[d.id] ? 'selected' : ''}`}
              onClick={() => addItem(d)}
            >
              <div className="pos-dish-plate">
                <span className="pos-dish-sym serif">{d.symbol || '○'}</span>
                {d.is_popular === 1 && <span className="pos-popular">★ Popular</span>}
                {cartMap[d.id] && <span className="pos-dish-qty mono">× {cartMap[d.id]}</span>}
              </div>
              <div className="pos-dish-info">
                <p className="pos-dish-name">{d.name}</p>
                <p className="pos-dish-price mono">${d.price}</p>
                <p className="pos-dish-sub">{d.description}</p>
              </div>
            </button>
          ))}
          {visible.length === 0 && (
            <p style={{ color: 'var(--text3)', padding: 24, gridColumn: '1/-1' }}>No items in this category.</p>
          )}
        </div>
      </section>

      {/* ── Order sidebar ──────────────────────────────────────────── */}
      <aside className="pos-order">
        <header className="pos-order-head">
          <div>
            <p className="eyebrow">Active Check</p>
            {/* Table selector */}
            <select
              value={selectedTable}
              onChange={e => { setSelectedTable(e.target.value); setActiveOrderId(null); }}
              style={{ background: 'transparent', color: 'var(--text1)', border: 'none', fontSize: 18, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              <option value="">— No table —</option>
              {tables.filter(t => t.status === 'empty' || t.status === 'occupied').map(t => (
                <option key={t.id} value={t.id}>{t.name} · {t.status}</option>
              ))}
            </select>
            <p className="pos-meta">
              {tableObj ? `${tableObj.covers} guests` : '—'} ·{' '}
              <span className="mono">{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </p>
          </div>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </header>

        {note && <p className="pos-note">Note · {note}</p>}
        {error && <p style={{ color: 'var(--danger)', fontSize: 12, margin: '4px 0' }}>{error}</p>}

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
                <div className="pos-qty-btns">
                  <button type="button" onClick={() => changeQty(c.menuItem.id, -1)}>−</button>
                  <button type="button" onClick={() => changeQty(c.menuItem.id, +1)}>+</button>
                </div>
              </div>
            </li>
          ))}
          {cart.length === 0 && (
            <p style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>Add items from the menu.</p>
          )}
        </ul>

        <div className="pos-extras">
          <button type="button" className="btn-outline"
            onClick={() => setNote('Allergies: shellfish — anniversary dessert')}>
            {note ? 'Edit note' : 'Add note'}
          </button>
          <button type="button" className={`btn-outline ${compApplied ? 'active' : ''}`}
            onClick={() => setCompApplied(true)} disabled={compApplied}>
            {compApplied ? 'Comped' : 'Comp'}
          </button>
          <button type="button" className={`btn-outline ${splitMode ? 'active' : ''}`}
            onClick={() => setSplitMode(true)}>
            {splitMode ? 'Split · 2' : 'Split'}
          </button>
        </div>

        <footer className="pos-totals">
          <div className="pos-total-row"><span>Subtotal</span><span className="mono">${subtotal.toFixed(2)}</span></div>
          <div className="pos-total-row"><span>Service · 18%</span><span className="mono">${service.toFixed(2)}</span></div>
          <div className="pos-total-row"><span>Tax · 8.75%</span><span className="mono">${tax.toFixed(2)}</span></div>
          <div className="pos-total-final"><span>Total Due</span><span className="serif">${total.toFixed(2)}</span></div>

          <button type="button"
            className={`pos-charge ${payMethod === 'card' ? 'done' : ''}`}
            disabled={payMethod !== 'open' || cart.length === 0 || busy}
            onClick={() => handleCharge('card')}
          >
            {busy ? '…' : payMethod === 'card' ? '✓ Charged' : `💳 Charge · $${total.toFixed(2)}`}
          </button>
          <div className="pos-alt-pay">
            <button type="button" className={payMethod === 'cash' ? 'active' : ''}
              disabled={payMethod !== 'open' || busy} onClick={() => handleCharge('cash')}>
              💵 Cash
            </button>
            <button type="button" className={payMethod === 'sent' ? 'active' : ''}
              disabled={payMethod !== 'open' || busy} onClick={handleSend}>
              🧾 Send
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
