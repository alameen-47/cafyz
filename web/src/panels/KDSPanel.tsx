import { useState, useEffect, useCallback, useRef } from 'react';
import { kdsApi, restaurantApi, type ApiKdsTicket, type ApiKdsTicketItem, type ApiRestaurant } from '../services/api';
import { autoReconnectBluetooth, connectBluetooth, connectUSB, disconnectPrinter, printKitchenTicket, printerStatus } from '../services/PrintService';
import { PrinterHelpBanner } from '../components/PrinterHelpBanner';
import { BluetoothIcon } from '../components/BluetoothIcon';
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
  const queueBusyRef = useRef(false);
  const queueWarnedRef = useRef(false);
  const lastConnectToastKeyRef = useRef('');

  useEffect(() => {
    setPrinter(printerStatus());
    void autoReconnectBluetooth().then((result) => {
      if (!result.connected) return;
      setPrinter({ type: 'bluetooth', name: result.name || 'Bluetooth Printer' });
    });
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

  const consumeCloudPrintQueue = useCallback(async () => {
    if (!autoPrint) return;
    if (printerStatus().type === 'none') {
      if (assignedKitchen && !queueWarnedRef.current) {
        queueWarnedRef.current = true;
        const msg = 'Kitchen printer is assigned but not connected on this device. Reconnect Bluetooth/USB in KDS.';
        setError(msg);
      }
      return;
    }
    if (queueWarnedRef.current) queueWarnedRef.current = false;
    if (queueBusyRef.current) return;
    queueBusyRef.current = true;
    try {
      const claimed = await kdsApi.claimPrintJobWait(
        `${navigator.userAgent.slice(0, 80)}:${Date.now()}`,
        15000,
      );
      const job = claimed.job;
      if (!job) return;
      if (!job.payload) {
        await kdsApi.completePrintJob(job.id, 'failed', 'Invalid print payload');
        return;
      }
      if (!job.payload.items || !Array.isArray(job.payload.items) || job.payload.items.length === 0) {
        await kdsApi.completePrintJob(job.id, 'failed', 'Invalid print payload: empty items');
        return;
      }
      try {
        await printKitchenTicket({
          restaurantName: restaurant?.name ?? 'Restaurant',
          ticketId: job.payload.ticketId,
          tableName: job.payload.tableName,
          serverName: job.payload.serverName,
          covers: job.payload.covers,
          station: job.payload.station,
          createdAt: job.payload.createdAt,
          items: job.payload.items,
          note: job.payload.note,
          parcel: job.payload.parcel,
        }, restaurant?.id, { allowDialog: false });
        await kdsApi.completePrintJob(job.id, 'printed');
      } catch (e) {
        const msg = (e as Error).message || 'Cloud print failed';
        await kdsApi.completePrintJob(job.id, 'failed', msg);
        setError(msg);
      }
    } catch (e) {
      const msg = (e as Error).message || 'Cloud print queue error';
      if (!queueWarnedRef.current) {
        queueWarnedRef.current = true;
        setError(msg);
      }
    } finally {
      queueBusyRef.current = false;
    }
  }, [assignedKitchen, autoPrint, restaurant?.id, restaurant?.name]);

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
      const toastKey = `kitchen:bluetooth:${name.toLowerCase()}`;
      if (lastConnectToastKeyRef.current !== toastKey) {
        lastConnectToastKeyRef.current = toastKey;
        toastBus.success(`Kitchen printer connected: ${name}`);
      }
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
      const toastKey = `kitchen:usb:${name.toLowerCase()}`;
      if (lastConnectToastKeyRef.current !== toastKey) {
        lastConnectToastKeyRef.current = toastKey;
        toastBus.success(`Kitchen printer connected: ${name}`);
      }
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
      .then((rows) => { setTickets(rows); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll frequently so auto-print feels near real-time after order send.
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      while (alive) {
        await consumeCloudPrintQueue();
        await sleep(300);
      }
    };
    void run();
    return () => { alive = false; };
  }, [consumeCloudPrintQueue]);

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
      {error && <p className="kds-error">{error}</p>}
      <PrinterHelpBanner />

      {/* ── Toolbar ── */}
      <div className="kds-toolbar">
        {/* Printer controls row */}
        <div className="kds-printer-row">
          <label className="kds-autoprint-label">
            <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} />
            Auto-print
          </label>

          <div className="kds-printer-btns">
            {printer.type !== 'none' ? (
              <button type="button" className="kds-btn-printer connected" onClick={disconnectKdsPrinter}>
                {printer.type === 'bluetooth' ? <BluetoothIcon /> : '🔌'}
                <span>{printer.name}</span>
                <span className="kds-disconnect">· Disconnect</span>
              </button>
            ) : (
              <>
                <button type="button" className="kds-btn-printer" onClick={connectKdsBluetooth} disabled={printBusy}>
                  <BluetoothIcon /> Bluetooth
                </button>
                <button type="button" className="kds-btn-printer" onClick={connectKdsUsb} disabled={printBusy}>
                  🔌 USB
                </button>
              </>
            )}
            <button type="button" className="kds-btn-printer" onClick={testKitchenPrint} disabled={printBusy}>
              {printBusy ? '…' : '🖨 Test'}
            </button>
          </div>

          {assignedKitchen && (
            <span className="kds-shared-label">
              Shared: {assignedKitchen.name} ({assignedKitchen.channel.toUpperCase()})
            </span>
          )}
        </div>

        {/* Station filter row */}
        <div className="kds-station-row">
          {STATIONS.map(s => (
            <button
              key={s}
              type="button"
              className={`kds-station-btn${station === s ? ' active' : ''}`}
              onClick={() => setStation(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Kanban columns ── */}
      <div className="kds-columns">
        <section className="kds-col">
          <div className="kds-col-header new">
            <span className="kds-col-dot" />
            <span className="kds-col-title">New</span>
            <span className="kds-col-count">{newTickets.length}</span>
          </div>
          <div className="kds-stack">
            {newTickets.length === 0
              ? <p className="kds-empty">No new tickets</p>
              : newTickets.map(t => (
                  <KDSCard key={t.id} ticket={t} busy={busy}
                    onFire={handleFire} onReady={handleReady} onDelivered={handleDelivered} />
                ))
            }
          </div>
        </section>

        <section className="kds-col">
          <div className="kds-col-header prep">
            <span className="kds-col-dot" />
            <span className="kds-col-title">In Prep</span>
            <span className="kds-col-count">{prepTickets.length}</span>
          </div>
          <div className="kds-stack">
            {prepTickets.length === 0
              ? <p className="kds-empty">No tickets in prep</p>
              : prepTickets.map(t => (
                  <KDSCard key={t.id} ticket={t} busy={busy}
                    onFire={handleFire} onReady={handleReady} onDelivered={handleDelivered} />
                ))
            }
          </div>
        </section>

        <section className="kds-col">
          <div className="kds-col-header ready">
            <span className="kds-col-dot" />
            <span className="kds-col-title">Ready · Pass</span>
            <span className="kds-col-count">{readyTickets.length}</span>
          </div>
          <div className="kds-stack">
            {readyTickets.length === 0
              ? <p className="kds-empty">No tickets ready</p>
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
