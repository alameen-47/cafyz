import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tablesApi, ordersApi, type ApiTable, type ApiOrder } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { pathForScreen } from '../routes';
import './MobilePanels.css';

const STATUS_DOT: Record<string, string> = {
  occupied:  'occupied',
  paying:    'paying',
  attention: 'attention',
  reserved:  'reserved',
  empty:     'empty',
};

export function MobileOrdersPanel() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [tables,  setTables]  = useState<ApiTable[]>([]);
  const [orders,  setOrders]  = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    Promise.all([tablesApi.list(), ordersApi.list()])
      .then(([t, o]) => { setTables(t); setOrders(o); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Only show occupied / paying / attention tables
  const activeTables = tables.filter(
    t => t.status === 'occupied' || t.status === 'paying' || t.status === 'attention',
  );

  // Lookup order for a table
  function orderForTable(tableId: string): ApiOrder | undefined {
    return orders.find(
      o => o.table_id === tableId && (o.status === 'open' || o.status === 'sent'),
    );
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="mobile-root">
      <header className="mobile-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="eyebrow">
            {user?.restaurant_name || 'Service'} · Dinner
          </p>
          <button
            type="button"
            onClick={handleLogout}
            style={{ fontSize: 11, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>
        <h1 className="serif">My Tables</h1>
        {loading ? (
          <p className="mobile-count" style={{ color: 'var(--text2)' }}>Loading…</p>
        ) : (
          <p className="mobile-count">{activeTables.length} active</p>
        )}
        {error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</p>}
      </header>

      <ul className="mobile-list">
        {activeTables.map(t => {
          const order = orderForTable(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                className="mobile-card card"
                onClick={() => navigate(`/mobile/table?id=${t.id}`)}
              >
                <span className={`mobile-dot ${STATUS_DOT[t.status] ?? 'occupied'}`} />
                <div>
                  <p className="mobile-table mono">{t.name}</p>
                  <p className="mobile-name">
                    {t.covers > 0 ? `${t.covers} covers` : 'Walk-in'}
                  </p>
                  <p className="mobile-course">
                    {t.course || (order ? order.status : '—')}
                  </p>
                </div>
                <span className="mobile-time mono">
                  {t.elapsed_min > 0 ? `${t.elapsed_min}m` : '—'}
                </span>
              </button>
            </li>
          );
        })}

        {!loading && activeTables.length === 0 && (
          <li>
            <p style={{ color: 'var(--text3)', padding: '24px 0', textAlign: 'center', fontSize: 13 }}>
              No active tables right now.
            </p>
          </li>
        )}
      </ul>

      <nav className="mobile-tabbar">
        <Link to={pathForScreen('mobileOrders')} className="active">Tables</Link>
        <Link to={pathForScreen('pos')}>POS</Link>
        <button type="button" onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>
          Account
        </button>
      </nav>
    </div>
  );
}
