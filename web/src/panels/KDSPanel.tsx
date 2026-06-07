import { useState, useEffect, useCallback, useRef } from 'react';
import { kdsApi, restaurantApi, type ApiKdsTicket, type ApiKdsTicketItem, type ApiRestaurant } from '../services/api';
import { connectBluetooth, connectUSB, disconnectPrinter, printKitchenTicket, printerStatus } from '../services/PrintService';
import { PrinterHelpBanner } from '../components/PrinterHelpBanner';
import { syncRestaurantLogoCache } from '../services/restaurantLogoStorage';
import { toastBus } from '../services/toastBus';
import './KDSPanel.css';

type AssignedPrinter = { role: 'kitchen' | 'cashier'; channel: 'bluetooth' | 'usb'; name: string };

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
  const [restaurant, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [station, setStation] = useState('All');
  const [busy,    setBusy]    = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('cafyz_kds_auto_print') !== '0');
  const [printer, setPrinter] = useState<{ type: 'none' | 'bluetooth' | 'usb'; name: string }>({ type: 'none', name: '' });
  const [assignedKitchen, setAssignedKitchen] = useState<AssignedPrinter | null>(null);
  const [printBusy, setPrintBusy] = useState(false);
  const printedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setPrinter(printerStatus());
    try {
      const raw = sessionStorage.getItem('cafyz_kds_printed_ids');
      if (!raw) return;
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) printedRef.current = new Set(ids.slice(-400));
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cafyz_kds_auto_print', autoPrint ? '1' : '0');
  }, [autoPrint]);

  useEffect(() => {
    restaurantApi.me().then(r => {
      setRestaurant(r);
      setAssignedKitchen(r.kitchen_printer ?? null);
      syncRestaurantLogoCache(r);
    }).catch(() => {});
  }, []);

  // Cross-device sync from backend printer registry.
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const r = await restaurantApi.me();
        if (!alive) return;
        setAssignedKitchen(r.kitchen_printer ?? null);
      } catch {
        // keep current state on transient sync failures
      }
    };
    const t = window.setInterval(sync, 6000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const persistPrinted = () => {
    try {
      sessionStorage.setItem('cafyz_kds_printed_ids', JSON.stringify(Array.from(printedRef.current).slice(-400)));
    } catch {
      // ignore storage failures
    }
  };

  const tryAutoPrint = async (list: ApiKdsTicket[]) => {
    if (!autoPrint) return;
    if (printerStatus().type === 'none') return;
    const fresh = list
      .filter(t => t.status === 'new')
      .filter(t => !printedRef.current.has(t.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    for (const t of fresh) {
      try {
        await printKitchenTicket({
          restaurantName: restaurant?.name ?? 'Restaurant',
          ticketId: t.id,
          tableName: t.table_name,
          serverName: t.server_name,
          covers: t.covers,
          station: t.station ?? undefined,
          createdAt: t.created_at,
          items: (t.items ?? []).map(i => ({
            name: i.name,
            qty: i.qty,
            mods: typeof i.mods === 'string' ? JSON.parse(i.mods || '[]') : (i.mods ?? []),
            alert: Boolean(i.alert),
          })),
        }, restaurant?.id, { allowDialog: false });
        printedRef.current.add(t.id);
      } catch (e) {
        setError((e as Error).message || 'Auto-print failed');
      }
    }
    persistPrinted();
  };

  async function connectKdsBluetooth() {
    setPrintBusy(true); setError('');
    try {
      const name = await connectBluetooth();
      setPrinter({ type: 'bluetooth', name });
      const updated = await restaurantApi.update({
        kitchen_printer: { role: 'kitchen', channel: 'bluetooth', name },
      });
      setRestaurant(updated);
      setAssignedKitchen(updated.kitchen_printer ?? null);
      toastBus.success(`Kitchen printer connected: ${name}`);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toastBus.error(`Bluetooth connection failed: ${msg}`);
    } finally {
      setPrintBusy(false);
    }
  }

  async function connectKdsUsb() {
    setPrintBusy(true); setError('');
    try {
      const name = await connectUSB();
      setPrinter({ type: 'usb', name });
      const updated = await restaurantApi.update({
        kitchen_printer: { role: 'kitchen', channel: 'usb', name },
      });
      setRestaurant(updated);
      setAssignedKitchen(updated.kitchen_printer ?? null);
      toastBus.success(`Kitchen printer connected: ${name}`);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toastBus.error(`USB connection failed: ${msg}`);
    } finally {
      setPrintBusy(false);
    }
  }

  function disconnectKdsPrinter() {
    disconnectPrinter();
    setPrinter({ type: 'none', name: '' });
    toastBus.info('Kitchen printer disconnected.');
  }

  async function testKitchenPrint() {
    setPrintBusy(true);
    setError('');
    try {
      const method = await printKitchenTicket({
        restaurantName: restaurant?.name ?? 'Restaurant',
        ticketId: `test-${Date.now()}`,
        tableName: 'TEST',
        serverName: 'Cafyz',
        covers: 2,
        station: station === 'All' ? 'EXPEDITE' : station.toUpperCase(),
        items: [
          { name: 'Printer test soup', qty: 1, mods: ['No salt'] },
          { name: 'Printer test steak', qty: 2, mods: ['Medium'], alert: true },
        ],
        note: 'KDS test print from Kitchen Panel',
      }, restaurant?.id);
      toastBus.success(
        method === 'dialog'
          ? 'Kitchen test opened in print preview.'
          : `Kitchen test sent via ${method}.`,
      );
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toastBus.error(`Kitchen print test failed: ${msg}`);
    } finally {
      setPrintBusy(false);
    }
  }

  const load = useCallback(() => {
    kdsApi.list({ status: undefined })
      .then(async (rows) => {
        setTickets(rows);
        await tryAutoPrint(rows);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [autoPrint, restaurant?.id, restaurant?.name]);

  useEffect(() => { load(); }, [load]);

  // Poll frequently so auto-print feels near real-time after order send.
  useEffect(() => {
    const t = setInterval(load, 5000);
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
      <PrinterHelpBanner />

      <div className="kds-stations">
        <label style={{ marginRight: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
          <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} />
          Auto-print new tickets
        </label>
        {printer.type !== 'none' ? (
          <button type="button" onClick={disconnectKdsPrinter}>
            {printer.type === 'bluetooth' ? '🔵' : '🔌'} {printer.name} · Disconnect
          </button>
        ) : (
          <>
            <button type="button" onClick={connectKdsBluetooth} disabled={printBusy}>🔵 Connect Bluetooth</button>
            <button type="button" onClick={connectKdsUsb} disabled={printBusy}>🔌 Connect USB</button>
          </>
        )}
        <button type="button" onClick={testKitchenPrint} disabled={printBusy}>
          {printBusy ? 'Testing…' : '🖨 Test Kitchen Print'}
        </button>
        {assignedKitchen && (
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>
            Shared with POS: {assignedKitchen.name} ({assignedKitchen.channel.toUpperCase()})
          </span>
        )}
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
