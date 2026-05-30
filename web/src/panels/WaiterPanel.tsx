import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { tablesApi, ordersApi, type ApiTable, type ApiOrder } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { TableStatus } from '@shared/types';
import './WaiterPanel.css';

const STATUS_CLASS: Record<TableStatus, string> = {
  empty: 'empty', reserved: 'reserved', occupied: 'occupied',
  paying: 'paying', attention: 'attention',
};

export function WaiterPanel() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [tables,     setTables]     = useState<ApiTable[]>([]);
  const [orders,     setOrders]     = useState<ApiOrder[]>([]);   // open/sent orders (for table→order lookup)
  const [fullOrder,  setFullOrder]  = useState<ApiOrder | null>(null); // full order with items
  const [selected,   setSelected]   = useState<string | null>(null);
  const [sheetOpen,  setSheetOpen]  = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadFloor();
  }, []);

  function loadFloor() {
    // Fetch all non-archived orders so we can look up 'sent' orders too
    Promise.all([
      tablesApi.list(),
      ordersApi.list(),
    ])
      .then(([t, o]) => {
        setTables(t);
        // Keep only open/sent orders for table lookups
        setOrders(o.filter((ord: ApiOrder) => ord.status === 'open' || ord.status === 'sent'));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  // ── Fetch full order with items when table selection changes ────────────────
  useEffect(() => {
    if (!selected) { setFullOrder(null); return; }

    const tableOrder = orders.find(
      o => o.table_id === selected && (o.status === 'open' || o.status === 'sent'),
    );

    if (!tableOrder) { setFullOrder(null); return; }

    setOrderLoading(true);
    ordersApi.get(tableOrder.id)
      .then(setFullOrder)
      .catch(console.error)
      .finally(() => setOrderLoading(false));
  }, [selected, orders]);

  const selectedTable = tables.find(t => t.id === selected);
  const orderItems    = fullOrder?.items ?? [];
  const total         = orderItems.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function sendToKitchen() {
    if (!fullOrder) return;
    setBusy(true);
    try {
      await ordersApi.updateStatus(fullOrder.id, 'sent'); // backend auto-creates KDS ticket
      await tablesApi.updateStatus(selected!, { status: 'occupied', course: 'Sent to kitchen' });
      // Refresh floor
      const [t, o] = await Promise.all([tablesApi.list(), ordersApi.list()]);
      setTables(t);
      setOrders(o.filter((ord: ApiOrder) => ord.status === 'open' || ord.status === 'sent'));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function markPaying() {
    if (!selected) return;
    setBusy(true);
    try {
      await tablesApi.updateStatus(selected, { status: 'paying', course: 'Bill requested' });
      const [t, o] = await Promise.all([tablesApi.list(), ordersApi.list()]);
      setTables(t);
      setOrders(o.filter((ord: ApiOrder) => ord.status === 'open' || ord.status === 'sent'));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function seatReserved() {
    if (!selected) return;
    setBusy(true);
    try {
      await tablesApi.updateStatus(selected, { status: 'occupied', course: 'Guests seated' });
      const [t, o] = await Promise.all([tablesApi.list(), ordersApi.list()]);
      setTables(t);
      setOrders(o.filter((ord: ApiOrder) => ord.status === 'open' || ord.status === 'sent'));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  function goToPOS() {
    // Pre-select the table in POS by navigating there; POS will show the table dropdown
    navigate(`/pos`);
  }

  function selectTable(tableId: string) {
    setSelected(tableId);
    setSheetOpen(true);
  }

  if (loading) return (
    <div className="waiter-layout">
      <p style={{ color: 'var(--text2)', padding: 32 }}>Loading floor…</p>
    </div>
  );

  return (
    <div className="waiter-layout">

      {/* ── Floor map ───────────────────────────────────────────────── */}
      <div className="waiter-floor">
        <div className="waiter-floor-head">
          <div className="waiter-floor-head-top">
            <div>
              <p className="eyebrow">Floor · {user?.restaurant_name || 'Service'}</p>
              <h2 className="serif">Table map</h2>
            </div>
            {(user?.role === 'owner' || user?.role === 'manager') &&
              user?.allowedScreens.includes('tableSetup') && (
              <button
                type="button"
                className="btn-gold waiter-setup-btn"
                onClick={() => navigate('/tables/setup')}
              >
                + Add Table
              </button>
            )}
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
        </div>

        <div className="waiter-grid">
          {tables.map(t => {
            const isRound = t.name?.includes('·0') && ['09', '10', '11'].some(n => t.name.endsWith(n));
            return (
              <button
                key={t.id}
                type="button"
                className={`waiter-table ${STATUS_CLASS[t.status]} ${isRound ? 'round' : ''} ${selected === t.id ? 'selected' : ''}`}
                onClick={() => selectTable(t.id)}
              >
                <span className="waiter-table-id">{t.name}</span>
                <span className="waiter-table-course">
                  {t.course || `${t.capacity}-top`}
                </span>
                {t.elapsed_min > 0 && (
                  <span className="waiter-table-time mono">{t.elapsed_min}m</span>
                )}
                {t.status === 'attention' && <span className="waiter-alert">!</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Order sheet ─────────────────────────────────────────────── */}
      {sheetOpen && selectedTable && (
        <aside className="waiter-sheet card">
          <header>
            <div>
              <p className="eyebrow">Order sheet</p>
              <h3 className="serif">
                {selectedTable.name}
                {selectedTable.covers > 0 && ` · ${selectedTable.covers} cov`}
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                Status: <span style={{ textTransform: 'capitalize' }}>{selectedTable.status}</span>
                {selectedTable.course ? ` · ${selectedTable.course}` : ''}
              </p>
            </div>
            <button type="button" className="btn-outline" onClick={() => setSheetOpen(false)}>
              Close
            </button>
          </header>

          {orderLoading ? (
            <p style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>Loading order…</p>
          ) : fullOrder && orderItems.length > 0 ? (
            <ul>
              {orderItems.map(item => (
                <li key={item.id}>
                  <span>{item.qty}×</span>
                  {item.name ?? item.menu_item_id}
                  {item.price ? (
                    <span className="mono">${(item.price * item.qty).toFixed(2)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--text3)', padding: '12px 0', fontSize: 13 }}>
              {selectedTable.status === 'empty'
                ? 'Table is empty.'
                : 'No open order on this table.'}
            </p>
          )}

          <footer>
            {total > 0 && <p className="waiter-total serif">${total.toFixed(2)}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Reserved → seat guests */}
              {selectedTable.status === 'reserved' && (
                <button type="button" className="btn-gold" onClick={seatReserved} disabled={busy}>
                  {busy ? '…' : '✓ Seat guests'}
                </button>
              )}
              {/* Empty → start new order via POS */}
              {selectedTable.status === 'empty' && (
                <button type="button" className="btn-gold" onClick={goToPOS}>
                  + Start order
                </button>
              )}
              {/* Open order → send to kitchen */}
              {fullOrder && fullOrder.status === 'open' && (
                <button type="button" className="btn-gold" onClick={sendToKitchen} disabled={busy}>
                  {busy ? '…' : 'Send to kitchen'}
                </button>
              )}
              {/* Sent → show status */}
              {fullOrder && fullOrder.status === 'sent' && (
                <p style={{ fontSize: 12, color: 'var(--success, #4ade80)', padding: '6px 0' }}>
                  ✓ Order sent to kitchen
                </p>
              )}
              {/* Request bill */}
              {(selectedTable.status === 'occupied' || selectedTable.status === 'attention') && (
                <button type="button" className="btn-outline" onClick={markPaying} disabled={busy}>
                  Request bill
                </button>
              )}
            </div>
          </footer>
        </aside>
      )}
    </div>
  );
}
