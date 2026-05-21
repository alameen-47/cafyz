import { useState, useEffect } from 'react';
import { tablesApi, ordersApi, type ApiTable, type ApiOrder } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { TableStatus } from '@shared/types';
import './WaiterPanel.css';

const STATUS_CLASS: Record<TableStatus, string> = {
  empty: 'empty', reserved: 'reserved', occupied: 'occupied', paying: 'paying', attention: 'attention',
};


export function WaiterPanel() {
  const { user } = useAuth();
  const [tables,   setTables]   = useState<ApiTable[]>([]);
  const [orders,   setOrders]   = useState<ApiOrder[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen,setSheetOpen]= useState(false);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(true);

  // Load tables + open orders on mount
  useEffect(() => {
    Promise.all([
      tablesApi.list(),
      ordersApi.list({ status: 'open' }),
    ])
      .then(([t, o]) => { setTables(t); setOrders(o); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    Promise.all([tablesApi.list(), ordersApi.list({ status: 'open' })])
      .then(([t, o]) => { setTables(t); setOrders(o); });
  }

  const selectedTable = tables.find(t => t.id === selected);
  const tableOrder    = orders.find(o => o.table_id === selected);

  async function sendToKitchen() {
    if (!tableOrder) return;
    setBusy(true);
    try {
      await ordersApi.updateStatus(tableOrder.id, 'sent');
      await tablesApi.updateStatus(selected!, { status: 'occupied', course: 'Sent to kitchen' });
      refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function markPaying() {
    if (!selected) return;
    setBusy(true);
    try {
      await tablesApi.updateStatus(selected, { status: 'paying', course: 'Bill' });
      refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  const orderItems = tableOrder?.items ?? [];
  const total = orderItems.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);

  if (loading) return <div className="waiter-layout"><p style={{ color: 'var(--text2)', padding: 32 }}>Loading floor…</p></div>;

  return (
    <div className="waiter-layout">
      {/* ── Floor map ────────────────────────────────────────────── */}
      <div className="waiter-floor">
        <div className="waiter-floor-head">
          <p className="eyebrow">Floor · {user?.restaurant_name || 'Service'}</p>
          <h2 className="serif">Table map</h2>
          {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
        </div>
        <div className="waiter-grid">
          {tables.map(t => {
            const isRound = ['T·09','T·10','T·11'].includes(t.name);
            return (
              <button
                key={t.id}
                type="button"
                className={`waiter-table ${STATUS_CLASS[t.status]} ${isRound ? 'round' : ''} ${selected === t.id ? 'selected' : ''}`}
                onClick={() => { setSelected(t.id); setSheetOpen(true); }}
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

      {/* ── Order sheet ──────────────────────────────────────────── */}
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

          {tableOrder && orderItems.length > 0 ? (
            <ul>
              {orderItems.map(item => (
                <li key={item.id}>
                  <span>{item.qty}×</span>
                  {item.name ?? item.menu_item_id}
                  {item.price ? <span className="mono">${(item.price * item.qty).toFixed(2)}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--text3)', padding: '12px 0', fontSize: 13 }}>
              {selectedTable.status === 'empty' ? 'Table is empty.' : 'No open order on this table.'}
            </p>
          )}

          <footer>
            {total > 0 && <p className="waiter-total serif">${total.toFixed(2)}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              {tableOrder && tableOrder.status === 'open' && (
                <button type="button" className="btn-gold" onClick={sendToKitchen} disabled={busy}>
                  {busy ? '…' : 'Send to kitchen'}
                </button>
              )}
              {selectedTable.status === 'occupied' && (
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
