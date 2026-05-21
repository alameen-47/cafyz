import { useState, useEffect, useCallback } from 'react';
import { kdsApi, type ApiKdsTicket, type ApiKdsTicketItem } from '../services/api';
import './KDSPanel.css';

// ── Helpers ───────────────────────────────────────────────────────────────────
function elapsedMin(createdAt: string): number {
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 60000);
}

function formatTimer(minutes: number) {
  const m = Math.floor(minutes);
  const s = Math.floor((minutes % 1) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── KDS Card ──────────────────────────────────────────────────────────────────
function KDSCard({
  ticket,
  onFire,
  onReady,
  onDelivered,
  busy,
}: {
  ticket:      ApiKdsTicket;
  onFire:      (id: string) => void;
  onReady:     (id: string) => void;
  onDelivered: (id: string) => void;
  busy:        string | null;
}) {
  const [elapsed, setElapsed] = useState(() => elapsedMin(ticket.created_at));
  const status = ticket.status;

  // Live timer tick
  useEffect(() => {
    if (status === 'delivered') return;
    const t = setInterval(() => setElapsed(elapsedMin(ticket.created_at)), 10000);
    return () => clearInterval(t);
  }, [ticket.created_at, status]);

  const isRed   = elapsed >= 15;
  const isAmber = elapsed >= 8 && elapsed < 15;
  const timerClass = status === 'ready'   ? 'ready'
                   : status === 'delivered' ? 'ready'
                   : isRed ? 'overdue' : isAmber ? 'push' : 'ontime';

  const items: ApiKdsTicketItem[] = ticket.items ?? [];

  return (
    <article className={`kds-card card ${status} ${isRed && status !== 'ready' ? 'urgent' : ''}`}>
      <header className="kds-card-head">
        <div>
          <p className="kds-ticket mono">#{ticket.id.slice(0, 8).toUpperCase()}</p>
          {ticket.vip === 1 && <span className="kds-vip">★ VIP</span>}
          <p className="kds-meta">
            {ticket.table_name} · {ticket.covers} cov · {ticket.server_name}
          </p>
        </div>
        <div className="kds-timer-wrap">
          <p className={`kds-timer mono ${timerClass}`}>{formatTimer(elapsed)}</p>
          <p className="kds-timer-state">
            {status === 'ready' || status === 'delivered' ? 'Ready'
              : isRed ? 'Overdue' : isAmber ? 'Push' : 'On Time'}
          </p>
        </div>
      </header>

      <ul className="kds-items">
        {items.map((it, i) => {
          const mods: string[] = typeof it.mods === 'string'
            ? JSON.parse(it.mods || '[]')
            : (it.mods ?? []);
          return (
            <li key={it.id ?? i} className={it.is_done ? 'done' : ''}>
              <span className="mono">{it.qty}</span>
              <div>
                <p>{it.name}</p>
                {mods.map((m, j) => (
                  <p key={j} className={it.alert && j === 0 ? 'alert' : ''}>
                    {it.alert && j === 0 ? '⚠ ' : '· '}{m}
                  </p>
                ))}
              </div>
              <span className="kds-station mono">{it.station}</span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className={`kds-action ${status}`}
        disabled={busy === ticket.id}
        onClick={() => {
          if (status === 'new')  onFire(ticket.id);
          if (status === 'prep') onReady(ticket.id);
          if (status === 'ready') onDelivered(ticket.id);
        }}
      >
        {busy === ticket.id ? '…'
          : status === 'ready'    ? '✓ Delivered'
          : status === 'prep'     ? '✓ Mark Ready'
          : '🔥 Fire'}
      </button>
    </article>
  );
}

// ── KDS Panel ─────────────────────────────────────────────────────────────────
const STATIONS = ['All', 'Grill', 'Poisson', 'Pasta', 'Garde', 'Pâtisserie'];

export function KDSPanel() {
  const [tickets, setTickets] = useState<ApiKdsTicket[]>([]);
  const [station, setStation] = useState('All');
  const [busy,    setBusy]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(() => {
    kdsApi.list({ status: undefined })
      .then(setTickets)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 15s for new tickets
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const stationFilter = station === 'All' ? '' : station.toUpperCase();

  const filtered = stationFilter
    ? tickets.filter(t => t.station?.toUpperCase() === stationFilter ||
        t.items?.some(i => i.station.toUpperCase() === stationFilter))
    : tickets;

  const newTickets  = filtered.filter(t => t.status === 'new');
  const prepTickets = filtered.filter(t => t.status === 'prep');
  const readyTickets= filtered.filter(t => t.status === 'ready');

  async function handleFire(id: string) {
    setBusy(id);
    try {
      const res = await kdsApi.fire(id);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: res.status as ApiKdsTicket['status'] } : t));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function handleReady(id: string) {
    setBusy(id);
    try {
      const res = await kdsApi.ready(id);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: res.status as ApiKdsTicket['status'] } : t));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function handleDelivered(id: string) {
    setBusy(id);
    try {
      const res = await kdsApi.delivered(id);
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: res.status as ApiKdsTicket['status'] } : t));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="kds-root"><p style={{ color: 'var(--text2)', padding: 32 }}>Loading tickets…</p></div>;

  return (
    <div className="kds-root">
      {error && <p style={{ color: 'var(--danger)', padding: '4px 16px', fontSize: 12 }}>{error}</p>}

      <div className="kds-stations">
        {STATIONS.map(s => (
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
          <h3 className="eyebrow">New · {newTickets.length}</h3>
          <div className="kds-stack">
            {newTickets.length === 0
              ? <p style={{ color: 'var(--text3)', fontSize: 13, padding: 8 }}>No new tickets</p>
              : newTickets.map(t => (
                  <KDSCard key={t.id} ticket={t} busy={busy}
                    onFire={handleFire} onReady={handleReady} onDelivered={handleDelivered} />
                ))
            }
          </div>
        </section>

        <section>
          <h3 className="eyebrow">In prep · {prepTickets.length}</h3>
          <div className="kds-stack">
            {prepTickets.length === 0
              ? <p style={{ color: 'var(--text3)', fontSize: 13, padding: 8 }}>No tickets in prep</p>
              : prepTickets.map(t => (
                  <KDSCard key={t.id} ticket={t} busy={busy}
                    onFire={handleFire} onReady={handleReady} onDelivered={handleDelivered} />
                ))
            }
          </div>
        </section>

        <section>
          <h3 className="eyebrow">Ready · {readyTickets.length}</h3>
          <div className="kds-stack">
            {readyTickets.length === 0
              ? <p style={{ color: 'var(--text3)', fontSize: 13, padding: 8 }}>No tickets ready</p>
              : readyTickets.map(t => (
                  <KDSCard key={t.id} ticket={t} busy={busy}
                    onFire={handleFire} onReady={handleReady} onDelivered={handleDelivered} />
                ))
            }
          </div>
        </section>
      </div>
    </div>
  );
}
