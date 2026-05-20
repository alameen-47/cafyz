import { Link } from 'react-router-dom';
import { pathForScreen } from '../routes';
import './MobilePanels.css';

const ORDERS = [
  { table: 'T·12', name: 'Vasseur', course: 'Mains', time: '00:41', status: 'occupied' },
  { table: 'T·10', name: 'Park', course: 'Needs water', time: '00:26', status: 'attention' },
  { table: 'T·07', name: 'Walk-in', course: 'Mains', time: '00:38', status: 'occupied' },
  { table: 'T·02', name: 'Bernard', course: 'Paying', time: '01:11', status: 'paying' },
  { table: 'T·04', name: 'Lévy', course: 'Order in', time: '00:09', status: 'occupied' },
];

export function MobileOrdersPanel() {
  return (
    <div className="mobile-root">
      <header className="mobile-header">
        <Link to={pathForScreen('login')} className="mobile-back">
          ← Login
        </Link>
        <p className="eyebrow">Service · Dinner</p>
        <h1 className="serif">My Tables</h1>
        <p className="mobile-count">6 active</p>
      </header>
      <ul className="mobile-list">
        {ORDERS.map(o => (
          <li key={o.table}>
            <Link to={pathForScreen('mobileTableDetail')} className="mobile-card card">
              <span className={`mobile-dot ${o.status}`} />
              <div>
                <p className="mobile-table mono">{o.table}</p>
                <p className="mobile-name">{o.name}</p>
                <p className="mobile-course">{o.course}</p>
              </div>
              <span className="mobile-time mono">{o.time}</span>
            </Link>
          </li>
        ))}
      </ul>
      <nav className="mobile-tabbar">
        <Link to={pathForScreen('mobileOrders')} className="active">
          Tables
        </Link>
        <Link to={pathForScreen('pos')}>POS</Link>
        <Link to={pathForScreen('login')}>Account</Link>
      </nav>
    </div>
  );
}
