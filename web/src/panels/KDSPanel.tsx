import { useState } from 'react';
import './KDSPanel.css';

type KDSItem = {
  qty: number;
  name: string;
  mods?: string[];
  station: string;
  done?: boolean;
  alert?: boolean;
};

type KDSOrder = {
  no: string;
  table: string;
  cover: string;
  server: string;
  elapsed: number;
  priority?: boolean;
  items: KDSItem[];
};

const NEW_ORDERS: KDSOrder[] = [
  {
    no: '#A-0428',
    table: 'T·17',
    cover: '6 cov',
    server: 'Léo D.',
    elapsed: 0.5,
    priority: true,
    items: [
      { qty: 2, name: 'Black Cod Miso', mods: ['No ginger ×1'], station: 'POISSON' },
      { qty: 1, name: 'Côte de Bœuf', mods: ['MR · 500g'], station: 'GRILL' },
      { qty: 3, name: 'Tuna Crudo', mods: [], station: 'GARDE' },
    ],
  },
  {
    no: '#A-0427',
    table: 'T·12',
    cover: '4 cov',
    server: 'Jules R.',
    elapsed: 3.2,
    items: [
      { qty: 1, name: 'Beef Tartare', mods: [], station: 'GARDE' },
      {
        qty: 2,
        name: 'Lobster Linguine',
        mods: ['Spice ×2', 'No tarragon'],
        alert: true,
        station: 'PASTA',
      },
      { qty: 1, name: 'Risotto Milanese', mods: [], station: 'PASTA' },
    ],
  },
];

const PREP_ORDERS: KDSOrder[] = [
  {
    no: '#A-0425',
    table: 'BAR',
    cover: '2 cov',
    server: 'Tomás L.',
    elapsed: 6.8,
    items: [
      { qty: 1, name: "Duck à l'Orange", mods: ['Confit leg only'], station: 'GRILL' },
      { qty: 1, name: 'Burrata di Andria', mods: [], done: true, station: 'GARDE' },
    ],
  },
  {
    no: '#A-0424',
    table: 'T·04',
    cover: '3 cov',
    server: 'Inès M.',
    elapsed: 9.5,
    items: [
      { qty: 3, name: 'Wagyu A5 Sando', mods: ['No wasabi ×2'], station: 'GRILL' },
      { qty: 2, name: 'Black Cod Miso', mods: [], done: true, station: 'POISSON' },
      {
        qty: 1,
        name: 'Tuna Crudo',
        mods: ['Allergy: shellfish'],
        alert: true,
        station: 'GARDE',
      },
    ],
  },
];

const READY_ORDERS: KDSOrder[] = [
  {
    no: '#A-0420',
    table: 'T·02',
    cover: '2 cov',
    server: 'Tomás L.',
    elapsed: 11.2,
    items: [
      { qty: 2, name: 'Soufflé Grand Marnier', mods: ['Together'], done: true, station: 'PÂTIS' },
    ],
  },
];

function formatTimer(minutes: number) {
  const m = Math.floor(minutes);
  const s = Math.floor((minutes % 1) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function KDSCard({
  order,
  status,
}: {
  order: KDSOrder;
  status: 'new' | 'prep' | 'ready';
}) {
  const isRed = order.elapsed >= 15;
  const isAmber = order.elapsed >= 8 && order.elapsed < 15;
  const timerClass = status === 'ready' ? 'ready' : isRed ? 'overdue' : isAmber ? 'push' : 'ontime';

  return (
    <article className={`kds-card card ${status} ${isRed ? 'urgent' : ''}`}>
      <header className="kds-card-head">
        <div>
          <p className="kds-ticket mono">{order.no}</p>
          {order.priority && <span className="kds-vip">★ VIP</span>}
          <p className="kds-meta">
            {order.table} · {order.cover} · {order.server}
          </p>
        </div>
        <div className="kds-timer-wrap">
          <p className={`kds-timer mono ${timerClass}`}>{formatTimer(order.elapsed)}</p>
          <p className="kds-timer-state">
            {status === 'ready' ? 'Ready' : isRed ? 'Overdue' : isAmber ? 'Push' : 'On Time'}
          </p>
        </div>
      </header>
      <ul className="kds-items">
        {order.items.map((it, i) => (
          <li key={i} className={it.done ? 'done' : ''}>
            <span className="mono">{it.qty}</span>
            <div>
              <p>{it.name}</p>
              {it.mods?.map((m, j) => (
                <p key={m} className={it.alert && j === 0 ? 'alert' : ''}>
                  {it.alert && j === 0 ? '⚠ ' : '· '}
                  {m}
                </p>
              ))}
            </div>
            <span className="kds-station mono">{it.station}</span>
          </li>
        ))}
      </ul>
      <button type="button" className={`kds-action ${status}`}>
        {status === 'ready'
          ? '✓ Delivered'
          : status === 'prep'
            ? '✓ Mark Ready'
            : '🔥 Fire'}
      </button>
    </article>
  );
}

export function KDSPanel() {
  const [station, setStation] = useState('All');
  const stations = ['All', 'Grill', 'Poisson', 'Pasta', 'Garde', 'Pâtisserie'];

  return (
    <div className="kds-root">
      <div className="kds-stations">
        {stations.map(s => (
          <button
            key={s}
            type="button"
            className={station === s ? 'active' : ''}
            onClick={() => setStation(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="kds-columns">
        <section>
          <h3 className="eyebrow">New · {NEW_ORDERS.length}</h3>
          <div className="kds-stack">
            {NEW_ORDERS.map(o => (
              <KDSCard key={o.no} order={o} status="new" />
            ))}
          </div>
        </section>
        <section>
          <h3 className="eyebrow">In prep · {PREP_ORDERS.length}</h3>
          <div className="kds-stack">
            {PREP_ORDERS.map(o => (
              <KDSCard key={o.no} order={o} status="prep" />
            ))}
          </div>
        </section>
        <section>
          <h3 className="eyebrow">Ready · {READY_ORDERS.length}</h3>
          <div className="kds-stack">
            {READY_ORDERS.map(o => (
              <KDSCard key={o.no} order={o} status="ready" />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
