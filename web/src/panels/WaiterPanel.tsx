import { useState } from 'react';
import type { TableStatus } from '@shared/types';
import './WaiterPanel.css';

type TableDef = {
  id: string;
  cov: number;
  status: TableStatus;
  minutes?: number;
  course?: string;
  round?: boolean;
};

const TABLES: TableDef[] = [
  { id: 'T·01', cov: 2, status: 'occupied', minutes: 22, course: 'Mains' },
  { id: 'T·02', cov: 2, status: 'paying', minutes: 71, course: 'Bill' },
  { id: 'T·03', cov: 2, status: 'occupied', minutes: 14, course: 'Starters' },
  { id: 'T·04', cov: 3, status: 'occupied', minutes: 9, course: 'Order in' },
  { id: 'T·05', cov: 4, status: 'empty' },
  { id: 'T·06', cov: 4, status: 'reserved', course: '20:30 Park' },
  { id: 'T·07', cov: 4, status: 'occupied', minutes: 38, course: 'Mains' },
  { id: 'T·08', cov: 4, status: 'occupied', minutes: 18, course: 'Drinks' },
  { id: 'T·09', cov: 2, status: 'occupied', minutes: 52, course: 'Dessert', round: true },
  { id: 'T·10', cov: 2, status: 'attention', minutes: 26, course: '!', round: true },
  { id: 'T·11', cov: 2, status: 'empty', round: true },
  { id: 'T·12', cov: 4, status: 'occupied', minutes: 41, course: 'Mains' },
  { id: 'BAR', cov: 8, status: 'occupied', minutes: 0, course: 'Open' },
  { id: 'PDR', cov: 12, status: 'occupied', minutes: 64, course: 'Tasting · 5/7' },
];

const STATUS_CLASS: Record<TableStatus, string> = {
  empty: 'empty',
  reserved: 'reserved',
  occupied: 'occupied',
  paying: 'paying',
  attention: 'attention',
};

export function WaiterPanel() {
  const [selected, setSelected] = useState('T·12');
  const [sheetOpen, setSheetOpen] = useState(true);

  return (
    <div className="waiter-layout">
      <div className="waiter-floor">
        <div className="waiter-floor-head">
          <p className="eyebrow">Floor · Dinner</p>
          <h2 className="serif">Table map</h2>
        </div>
        <div className="waiter-grid">
          {TABLES.map(t => (
            <button
              key={t.id}
              type="button"
              className={`waiter-table ${STATUS_CLASS[t.status]} ${t.round ? 'round' : ''} ${
                selected === t.id ? 'selected' : ''
              }`}
              onClick={() => {
                setSelected(t.id);
                setSheetOpen(true);
              }}
            >
              <span className="waiter-table-id">{t.id}</span>
              <span className="waiter-table-course">
                {t.course ?? `${t.cov}-top`}
              </span>
              {t.minutes != null && t.minutes > 0 && (
                <span className="waiter-table-time mono">{t.minutes}m</span>
              )}
              {t.status === 'attention' && <span className="waiter-alert">!</span>}
            </button>
          ))}
        </div>
      </div>

      {sheetOpen && (
        <aside className="waiter-sheet card">
          <header>
            <div>
              <p className="eyebrow">Order sheet</p>
              <h3 className="serif">{selected} · Vasseur</h3>
            </div>
            <button type="button" className="btn-outline" onClick={() => setSheetOpen(false)}>
              Close
            </button>
          </header>
          <ul>
            <li>
              <span>2×</span> Black Cod Miso <span className="mono">$84</span>
            </li>
            <li>
              <span>1×</span> Côte de Bœuf <span className="mono">$64</span>
            </li>
            <li className="held">
              <span>1×</span> Riesling, Trimbach <span className="mono">$78</span>
            </li>
          </ul>
          <footer>
            <p className="waiter-total serif">$226.00</p>
            <button type="button" className="btn-gold">
              Send to kitchen
            </button>
          </footer>
        </aside>
      )}
    </div>
  );
}
