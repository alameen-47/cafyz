import { useEffect } from 'react';
import { kdsApi, restaurantApi } from '../services/api';
import { ensureBluetoothReady, printKitchenTicket, printerStatus } from '../services/PrintService';
import { storageGet } from '../utils/safeStorage';

function autoPrintEnabled(): boolean {
  return storageGet('cafyz_kds_auto_print') !== '0';
}

/** Poll cloud kitchen print queue and print to connected BLE/USB printer. */
export function useKitchenPrintWorker(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let restaurantName = 'Restaurant';
    let restaurantId = '';
    let assignedKitchen: { channel: 'bluetooth' | 'usb'; name: string } | null = null;
    let idleBackoffMs = 5000;

    const syncRestaurant = async () => {
      try {
        const r = await restaurantApi.me();
        if (!alive) return;
        restaurantName = r.name || restaurantName;
        restaurantId = r.id;
        assignedKitchen = r.kitchen_printer
          ? { channel: r.kitchen_printer.channel, name: r.kitchen_printer.name }
          : null;
        if (assignedKitchen?.channel === 'bluetooth' && autoPrintEnabled()) {
          try {
            await ensureBluetoothReady(assignedKitchen.name);
          } catch {
            /* BLE unavailable — skip until printer setup */
          }
        }
      } catch {
        // keep last-known config
      }
    };

    const consumeOne = async () => {
      if (!alive || !assignedKitchen || printerStatus().type === 'none') {
        idleBackoffMs = 8000;
        return;
      }
      if (!autoPrintEnabled()) {
        idleBackoffMs = 5000;
        return;
      }
      idleBackoffMs = 1500;
      try {
        const claimed = await kdsApi.claimPrintJobWait(`web-v2:${Date.now()}`, 8000);
        const job = claimed.job;
        if (!job?.payload || !Array.isArray(job.payload.items) || job.payload.items.length === 0) {
          if (job?.id) await kdsApi.completePrintJob(job.id, 'failed', 'Invalid print payload');
          return;
        }
        try {
          await printKitchenTicket({
            restaurantName,
            ticketId: job.payload.ticketId,
            tableName: job.payload.tableName,
            serverName: job.payload.serverName,
            covers: job.payload.covers,
            station: job.payload.station,
            createdAt: job.payload.createdAt,
            items: job.payload.items,
            note: job.payload.note,
            parcel: job.payload.parcel,
          }, restaurantId, { allowDialog: false, channel: assignedKitchen.channel });
          await kdsApi.completePrintJob(job.id, 'printed');
        } catch (e) {
          await kdsApi.completePrintJob(job.id, 'failed', (e as Error).message || 'Print failed');
        }
      } catch {
        // queue empty or network blip
      }
    };

    void syncRestaurant();
    const onSent = () => { void syncRestaurant(); };
    window.addEventListener('CAFYZ_ORDER_SENT', onSent);
    const syncTimer = window.setInterval(() => { void syncRestaurant(); }, 120_000);
    const loop = async () => {
      while (alive) {
        await consumeOne();
        await new Promise(r => setTimeout(r, idleBackoffMs));
      }
    };
    void loop();
    return () => {
      alive = false;
      window.removeEventListener('CAFYZ_ORDER_SENT', onSent);
      window.clearInterval(syncTimer);
    };
  }, [enabled]);
}
