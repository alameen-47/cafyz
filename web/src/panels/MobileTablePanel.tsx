import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  tablesApi, ordersApi, menuApi,
  type ApiTable, type ApiOrder, type ApiMenuItem, type ApiOrderItem,
} from '../services/api';
import { pathForScreen } from '../routes';
import './MobilePanels.css';

export function MobileTablePanel({ addItemMode }: { addItemMode?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('id') ?? '';

  const [table,    setTable]    = useState<ApiTable | null>(null);
  const [order,    setOrder]    = useState<ApiOrder | null>(null);
  const [menu,     setMenu]     = useState<ApiMenuItem[]>([]);
  const [items,    setItems]    = useState<ApiOrderItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  // ── Load table + active order ───────────────────────────────────────────────
  useEffect(() => {
    if (!tableId) { setLoading(false); return; }

    const load = async () => {
      try {
        const [tables, orders] = await Promise.all([
          tablesApi.list(),
          ordersApi.list({ status: 'open' }),
        ]);
        const tbl = tables.find(t => t.id === tableId) ?? null;
        setTable(tbl);

        const activeOrder = orders.find(
          o => o.table_id === tableId && (o.status === 'open' || o.status === 'sent'),
        ) ?? null;

        if (activeOrder) {
          const full = await ordersApi.get(activeOrder.id);
          setOrder(full);
          setItems(full.items ?? []);
        }

        if (addItemMode) {
          const menuItems = await menuApi.list();
          setMenu(menuItems);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tableId, addItemMode]);

  // ── Add item to order ───────────────────────────────────────────────────────
  async function addToOrder(menuItem: ApiMenuItem) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      let orderId = order?.id ?? null;

      // Create order if none exists
      if (!orderId) {
        const created = await ordersApi.create({
          table_id: tableId || undefined,
          covers:   table?.covers || 2,
        });
        orderId = created.id;
        setOrder(created);
      }

      await ordersApi.addItem(orderId, {
        menu_item_id: menuItem.id,
        qty:          1,
        mods:         [],
      });

      // Reload full order with items
      const full = await ordersApi.get(orderId);
      setOrder(full);
      setItems(full.items ?? []);

      // Navigate back to table view
      navigate(`/mobile/table?id=${tableId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ── Send to kitchen ─────────────────────────────────────────────────────────
  async function sendToKitchen() {
    if (!order || busy) return;
    setBusy(true); setError('');
    try {
      await ordersApi.updateStatus(order.id, 'sent');
      await tablesApi.updateStatus(tableId, { status: 'occupied', course: 'Sent to kitchen' });
      navigate(pathForScreen('mobileOrders'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = items.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);

  const title = addItemMode
    ? 'Add item'
    : table
      ? `${table.covers > 0 ? `${table.covers} cov` : 'Walk-in'}`
      : '…';

  if (loading) return (
    <div className="mobile-root">
      <header className="mobile-header">
        <Link to={pathForScreen('mobileOrders')} className="mobile-back">← Tables</Link>
        <h1 className="serif">Loading…</h1>
      </header>
    </div>
  );

  if (!tableId || !table) return (
    <div className="mobile-root">
      <header className="mobile-header">
        <Link to={pathForScreen('mobileOrders')} className="mobile-back">← Tables</Link>
        <h1 className="serif">Table not found</h1>
      </header>
    </div>
  );

  return (
    <div className="mobile-root">
      <header className="mobile-header">
        <Link to={pathForScreen('mobileOrders')} className="mobile-back">← Tables</Link>
        <p className="eyebrow">Table · {table.name}</p>
        <h1 className="serif">{title}</h1>
        {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{error}</p>}
      </header>

      {/* ── Add item: show menu grid ─────────────────────────────────── */}
      {addItemMode ? (
        <div className="mobile-add-grid">
          {menu.slice(0, 12).map(d => (
            <button
              key={d.id}
              type="button"
              className="mobile-add-dish card"
              onClick={() => addToOrder(d)}
              disabled={busy}
            >
              <span className="serif">{d.symbol || '○'}</span>
              <p>{d.name}</p>
              <p className="mono">${d.price.toFixed(2)}</p>
            </button>
          ))}
          {menu.length === 0 && (
            <p style={{ color: 'var(--text3)', fontSize: 13, gridColumn: '1/-1', padding: 16 }}>
              No menu items available.
            </p>
          )}
        </div>
      ) : (
        /* ── Order summary ────────────────────────────────────────────── */
        <ul className="mobile-list compact">
          {items.map(item => (
            <li key={item.id} className="mobile-line">
              <span>{item.qty}× {item.name ?? item.menu_item_id}</span>
              {item.price ? (
                <span className="mono">${(item.price * item.qty).toFixed(2)}</span>
              ) : null}
            </li>
          ))}
          {items.length === 0 && (
            <li>
              <p style={{ color: 'var(--text3)', padding: '16px 0', fontSize: 13 }}>
                No items on this order yet.
              </p>
            </li>
          )}
          {total > 0 && (
            <li className="mobile-line" style={{ borderTop: '0.5px solid var(--gold-line)', marginTop: 8, paddingTop: 8, fontWeight: 600 }}>
              <span>Total</span>
              <span className="mono serif">${total.toFixed(2)}</span>
            </li>
          )}
        </ul>
      )}

      <footer className="mobile-footer">
        {!addItemMode && (
          <Link
            to={`/mobile/add-item?id=${tableId}`}
            className="btn-outline mobile-footer-btn"
          >
            + Add item
          </Link>
        )}
        {!addItemMode && order && order.status === 'open' && (
          <button
            type="button"
            className="btn-gold mobile-footer-btn"
            onClick={sendToKitchen}
            disabled={busy || items.length === 0}
          >
            {busy ? '…' : 'Send to kitchen'}
          </button>
        )}
        {!addItemMode && order && order.status === 'sent' && (
          <p style={{ fontSize: 12, color: 'var(--success)', textAlign: 'center', padding: '8px 0' }}>
            ✓ Sent to kitchen
          </p>
        )}
      </footer>
    </div>
  );
}
