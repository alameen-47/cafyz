import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Bluetooth, Loader2, Printer, ReceiptText, CreditCard, X, Usb, RefreshCw, Unplug } from 'lucide-react';
import { toast } from './Toast';
import { restaurantApi, type ApiRestaurant } from '../../services/api';
import {
  autoReconnectBluetooth, connectBluetoothBleForRole, connectBluetoothForRole, connectUSB, disconnectPrinter,
  ensureBluetoothReady, printKitchenTicket, printTest, printerChannels, printerStatus,
} from '../../services/PrintService';
import { getPrinterEnvironment, isIosDevice } from '../../services/printerEnvironment';
import { isNativeApp } from '../../services/platformEnv';
import {
  canUseClassicBluetooth,
  nativeConnectClassic,
  nativeListPairedPrinters,
  type PairedPrinterDevice,
} from '../../services/nativePrinter';
import { PrinterHelpBanner } from './PrinterHelpBanner';
import { BluetoothIcon } from './BluetoothIcon';

type PrinterRole = 'kitchen' | 'cashier';
type PrinterChannel = 'bluetooth' | 'usb';
type PrinterAssignment = { role: PrinterRole; channel: PrinterChannel; name: string };

interface Props {
  onClose?: () => void;
  kitchen?: string | null;
  cashier?: string | null;
  onRestaurantUpdate: (r: ApiRestaurant) => void;
  compact?: boolean;
  /** Desktop: full-screen overlay so the panel is not clipped by POS layout */
  modal?: boolean;
  restaurantName?: string;
  restaurantId?: string;
  logoUrl?: string | null;
  kitchenPrinter?: PrinterAssignment | null;
  cashierPrinter?: PrinterAssignment | null;
}

function roleLabel(role: PrinterRole) {
  return role === 'kitchen' ? 'Kitchen' : 'Cashier';
}

function assignmentFromProps(
  role: PrinterRole,
  name?: string | null,
  full?: PrinterAssignment | null,
): PrinterAssignment | null {
  if (full) return full;
  if (!name) return null;
  return { role, channel: 'bluetooth', name };
}

function roleStatus(
  assigned: PrinterAssignment | null,
  live: ReturnType<typeof printerStatus>,
): 'none' | 'configured' | 'connected' {
  if (!assigned) return 'none';
  if (live.type === 'none') return 'configured';
  if (assigned.channel !== live.type) return 'configured';
  const liveName = live.name.trim().toLowerCase();
  const assignedName = assigned.name.trim().toLowerCase();
  if (!liveName || liveName === assignedName || assignedName.includes(liveName) || liveName.includes(assignedName)) {
    return 'connected';
  }
  return 'configured';
}

const STATUS_COLOR = {
  none: '#6b82a0',
  configured: '#f59e0b',
  connected: '#22c55e',
} as const;

function PanelBody({
  onClose, connectTarget, setConnectTarget, busy, error, live, env,
  kitchenAssignment, cashierAssignment, channels,
  onConnectBluetooth, onConnectBle, onConnectClassic, onConnectUSB, onReconnect, onDisconnect,
  onTestKitchen, onTestCashier, onClearAssignment,
  pairedPrinters, loadingPaired,
}: {
  onClose?: () => void;
  connectTarget: PrinterRole;
  setConnectTarget: (r: PrinterRole) => void;
  busy: boolean;
  error: string;
  live: ReturnType<typeof printerStatus>;
  env: ReturnType<typeof getPrinterEnvironment>;
  kitchenAssignment: PrinterAssignment | null;
  cashierAssignment: PrinterAssignment | null;
  channels: ReturnType<typeof printerChannels>;
  onConnectBluetooth: () => void;
  onConnectBle: () => void;
  onConnectClassic: (device: PairedPrinterDevice) => void;
  onConnectUSB: () => void;
  pairedPrinters: PairedPrinterDevice[];
  loadingPaired: boolean;
  onReconnect: () => void;
  onDisconnect: () => void;
  onTestKitchen: () => void;
  onTestCashier: () => void;
  onClearAssignment: (role: PrinterRole) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5">
          <Printer size={13} style={{ color: '#1e7fff' }} />
          <span style={{ color: '#e8eef8', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem' }}>
            Printer setup
          </span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1 min-w-[32px] min-h-[44px] flex items-center justify-center" style={{ color: '#6b82a0' }} aria-label="Close">
            <X size={14} />
          </button>
        )}
      </div>

      <PrinterHelpBanner />

      <div className="mb-2.5 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(30,127,255,0.06)', border: '1px solid rgba(30,127,255,0.1)' }}>
        <p style={{ color: '#6b82a0', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
          This device
        </p>
        {live.type !== 'none' ? (
          <div className="flex items-center gap-2">
            {live.type === 'bluetooth' ? <BluetoothIcon size={14} /> : <Usb size={14} style={{ color: '#1e7fff' }} />}
            <span style={{ color: '#e8eef8', fontSize: '0.78rem', fontWeight: 600 }} className="truncate flex-1">{live.name}</span>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
          </div>
        ) : (
          <p style={{ color: '#6b82a0', fontSize: '0.75rem' }}>No printer connected — tap Pick Bluetooth printer below</p>
        )}
      </div>

      <div className="flex gap-1 mb-2 p-0.5 rounded-lg" style={{ background: 'rgba(30,127,255,0.06)' }}>
        {(['kitchen', 'cashier'] as const).map(role => (
          <button key={role} type="button" disabled={busy} onClick={() => setConnectTarget(role)}
            className="flex-1 py-1.5 rounded-md text-[0.68rem] font-semibold capitalize min-h-[44px]"
            style={{
              background: connectTarget === role ? 'rgba(30,127,255,0.18)' : 'transparent',
              color: connectTarget === role ? '#e8eef8' : '#6b82a0',
            }}>
            {role}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 mb-2">
        {[
          { Icon: ReceiptText, role: 'kitchen' as const, assignment: kitchenAssignment },
          { Icon: CreditCard, role: 'cashier' as const, assignment: cashierAssignment },
        ].map(({ Icon, role, assignment }) => {
          const status = roleStatus(assignment, live);
          return (
            <div key={role} className="flex items-center gap-2 px-2 py-2 rounded-lg"
              style={{ background: 'rgba(30,127,255,0.05)', border: '1px solid rgba(30,127,255,0.08)' }}>
              <Icon size={14} style={{ color: '#1e7fff' }} />
              <div className="flex-1 min-w-0">
                <p style={{ color: '#6b82a0', fontSize: '0.6rem', textTransform: 'uppercase' }}>{roleLabel(role)}</p>
                <p style={{ color: assignment ? '#e8eef8' : '#6b82a0', fontSize: '0.72rem' }} className="truncate">
                  {assignment ? `${assignment.name} · ${assignment.channel.toUpperCase()}` : 'Not configured'}
                </p>
                <p style={{ color: STATUS_COLOR[status], fontSize: '0.62rem', marginTop: 2 }}>
                  {status === 'connected' ? 'Ready on this device' : status === 'configured' ? 'Saved — connect below' : 'Not set up'}
                </p>
              </div>
              {assignment && (
                <button type="button" disabled={busy} onClick={() => onClearAssignment(role)}
                  className="text-[0.6rem] px-1.5 py-1 rounded min-h-[32px]"
                  style={{ color: '#6b82a0', background: 'rgba(255,255,255,0.04)' }}>
                  Clear
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mb-2 px-2 py-1.5 rounded-lg text-[0.68rem]" style={{ color: '#ff3b5c', background: 'rgba(255,59,92,0.08)' }}>
          {error}
        </p>
      )}

      <div className="space-y-1.5 mb-2">
        <p style={{ color: '#6b82a0', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', paddingInline: 2 }}>
          Connect as {roleLabel(connectTarget)}
        </p>

        {canUseClassicBluetooth() && (
          <div className="space-y-1">
            <p style={{ color: '#6b82a0', fontSize: '0.62rem', paddingInline: 2 }}>
              Paired printers (tap to connect)
            </p>
            {loadingPaired ? (
              <p className="flex items-center gap-2 px-2 py-2 text-[0.72rem]" style={{ color: '#6b82a0' }}>
                <Loader2 size={12} className="animate-spin" /> Loading paired devices…
              </p>
            ) : pairedPrinters.length === 0 ? (
              <p className="px-2 py-2 rounded-lg text-[0.68rem]" style={{ color: '#6b82a0', background: 'rgba(30,127,255,0.04)' }}>
                No paired printers found. Pair your printer in Android Settings → Bluetooth, then return here.
              </p>
            ) : (
              pairedPrinters.map(device => (
                <button key={device.address} type="button" disabled={busy}
                  onClick={() => onConnectClassic(device)}
                  className="w-full px-2.5 py-2.5 rounded-lg text-left min-h-[44px]"
                  style={{ background: 'rgba(30,127,255,0.08)', border: '1px solid rgba(30,127,255,0.12)' }}>
                  <span style={{ color: '#e8eef8', fontSize: '0.75rem', fontWeight: 600 }} className="block truncate">
                    {device.name}
                  </span>
                  <span style={{ color: '#6b82a0', fontSize: '0.62rem' }}>
                    {device.address} · {device.type}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {env.canUseBluetooth && (
          <button type="button" disabled={busy} onClick={onConnectBluetooth}
            className="w-full py-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 min-h-[48px]"
            style={{ background: 'linear-gradient(135deg, #1e7fff, #00c6ff)', color: '#fff', opacity: busy ? 0.7 : 1 }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bluetooth size={14} />}
            {canUseClassicBluetooth() ? 'Connect Bluetooth' : isNativeApp() ? 'Pick Bluetooth printer' : 'Connect Bluetooth'}
          </button>
        )}

        {canUseClassicBluetooth() && env.canUseBluetooth && (
          <button type="button" disabled={busy} onClick={onConnectBle}
            className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 min-h-[40px]"
            style={{ background: 'rgba(30,127,255,0.06)', color: '#6b82a0' }}>
            <Bluetooth size={12} /> Scan for BLE-only printer
          </button>
        )}

        {!isIosDevice() && env.usbAvailable && env.platform !== 'ios' && (
          <button type="button" disabled={busy} onClick={onConnectUSB}
            className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 min-h-[44px]"
            style={{ background: 'rgba(30,127,255,0.1)', color: '#a8bdd4', border: '1px solid rgba(30,127,255,0.2)', opacity: busy ? 0.7 : 1 }}>
            <Usb size={14} /> Connect USB printer
          </button>
        )}

        {env.canUseBluetooth && (
          <button type="button" disabled={busy} onClick={onReconnect}
            className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 min-h-[40px]"
            style={{ background: 'rgba(30,127,255,0.06)', color: '#6b82a0' }}>
            <RefreshCw size={12} /> Reconnect saved printer
          </button>
        )}
      </div>

      <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: 'rgba(30,127,255,0.08)' }}>
        <p style={{ color: '#6b82a0', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: 8, paddingInline: 2 }}>
          Test print
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={busy} onClick={onTestKitchen}
            className="py-2.5 rounded-lg text-[0.68rem] font-medium min-h-[44px]"
            style={{ background: 'rgba(30,127,255,0.08)', color: '#1e7fff', border: '1px solid rgba(30,127,255,0.12)' }}>
            Kitchen test
          </button>
          <button type="button" disabled={busy} onClick={onTestCashier}
            className="py-2.5 rounded-lg text-[0.68rem] font-medium min-h-[44px]"
            style={{ background: 'rgba(30,127,255,0.08)', color: '#1e7fff', border: '1px solid rgba(30,127,255,0.12)' }}>
            Cashier test
          </button>
        </div>

        {(channels.bluetooth || channels.usb) && (
          <button type="button" disabled={busy} onClick={onDisconnect}
            className="w-full py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 min-h-[40px]"
            style={{ background: 'rgba(255,59,92,0.08)', color: '#ff3b5c' }}>
            <Unplug size={13} /> Disconnect
          </button>
        )}
      </div>
    </>
  );
}

export function PrinterSetupPanel({
  onClose,
  kitchen,
  cashier,
  onRestaurantUpdate,
  compact,
  modal,
  restaurantName,
  restaurantId,
  logoUrl,
  kitchenPrinter: kitchenPrinterProp,
  cashierPrinter: cashierPrinterProp,
}: Props) {
  const [connectTarget, setConnectTarget] = useState<PrinterRole>('kitchen');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(printerStatus());
  const [pairedPrinters, setPairedPrinters] = useState<PairedPrinterDevice[]>([]);
  const [loadingPaired, setLoadingPaired] = useState(false);
  const env = getPrinterEnvironment();
  const lastToastKey = useRef('');

  const kitchenAssignment = assignmentFromProps('kitchen', kitchen, kitchenPrinterProp ?? null);
  const cashierAssignment = assignmentFromProps('cashier', cashier, cashierPrinterProp ?? null);
  const targetAssignment = connectTarget === 'kitchen' ? kitchenAssignment : cashierAssignment;

  const refreshLive = useCallback(() => {
    setLive(printerStatus());
  }, []);

  useEffect(() => {
    const hint = kitchenAssignment?.name || cashierAssignment?.name;
    void autoReconnectBluetooth(hint).finally(refreshLive);
  }, [kitchenAssignment?.name, cashierAssignment?.name, refreshLive]);

  const loadPairedPrinters = useCallback(async () => {
    if (!canUseClassicBluetooth()) {
      setPairedPrinters([]);
      return;
    }
    setLoadingPaired(true);
    try {
      setPairedPrinters(await nativeListPairedPrinters());
      setError('');
    } catch (e) {
      setPairedPrinters([]);
      setError((e as Error).message);
    } finally {
      setLoadingPaired(false);
    }
  }, []);

  useEffect(() => {
    void loadPairedPrinters();
  }, [loadPairedPrinters]);

  async function assignPrinter(role: PrinterRole, channel: PrinterChannel, name: string) {
    const payload = role === 'kitchen'
      ? { kitchen_printer: { role: 'kitchen' as const, channel, name } }
      : { cashier_printer: { role: 'cashier' as const, channel, name } };
    onRestaurantUpdate(await restaurantApi.update(payload));
  }

  async function clearAssignment(role: PrinterRole) {
    const payload = role === 'kitchen' ? { kitchen_printer: null } : { cashier_printer: null };
    onRestaurantUpdate(await restaurantApi.update(payload));
    toast.success(`${roleLabel(role)} printer cleared`);
  }

  function toastOnce(key: string, fn: () => void) {
    if (lastToastKey.current === key) return;
    lastToastKey.current = key;
    fn();
  }

  async function connectBluetoothName(name: string) {
    refreshLive();
    await assignPrinter(connectTarget, 'bluetooth', name);
    toastOnce(`${connectTarget}:bt:${name}`, () => {
      toast.success(`${roleLabel(connectTarget)} ready`, name);
    });
  }

  async function handleConnectClassic(device: PairedPrinterDevice) {
    setBusy(true);
    setError('');
    try {
      const name = await nativeConnectClassic(device.address, device.name);
      await connectBluetoothName(name);
      void loadPairedPrinters();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error('Bluetooth failed', msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectBluetooth() {
    setBusy(true);
    setError('');
    try {
      const name = await connectBluetoothForRole(targetAssignment?.name);
      await connectBluetoothName(name);
      void loadPairedPrinters();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error('Bluetooth failed', msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectBle() {
    setBusy(true);
    setError('');
    try {
      const name = await connectBluetoothBleForRole(targetAssignment?.name);
      await connectBluetoothName(name);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error('BLE scan failed', msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectUSB() {
    setBusy(true);
    setError('');
    try {
      const name = await connectUSB();
      refreshLive();
      await assignPrinter(connectTarget, 'usb', name);
      toastOnce(`${connectTarget}:usb:${name}`, () => {
        toast.success(`${roleLabel(connectTarget)} ready`, name);
      });
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error('USB failed', msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleReconnect() {
    setBusy(true);
    setError('');
    try {
      const hint = targetAssignment?.name || kitchenAssignment?.name || cashierAssignment?.name;
      const result = await autoReconnectBluetooth(hint);
      refreshLive();
      if (result.connected) {
        toast.success('Reconnected', result.name || 'Bluetooth printer');
      } else {
        setError('Could not reconnect. Tap Pick Bluetooth printer and select your device.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    disconnectPrinter();
    refreshLive();
    toast.info('Disconnected', 'Connect again when you need to print.');
  }

  async function prepareForPrint(assignment: PrinterAssignment | null) {
    if (!assignment) throw new Error('Configure this printer first (Connect as kitchen/cashier).');
    if (assignment.channel === 'usb') return;
    const ok = await ensureBluetoothReady(assignment.name);
    if (!ok) {
      throw new Error('Bluetooth printer not connected. Tap Pick Bluetooth printer first.');
    }
    refreshLive();
  }

  async function testKitchen() {
    setBusy(true);
    setError('');
    try {
      await prepareForPrint(kitchenAssignment);
      const method = await printKitchenTicket({
        restaurantName: restaurantName || 'Cafyz',
        ticketId: `test-${Date.now()}`,
        tableName: 'TEST',
        serverName: 'Cafyz',
        covers: 2,
        station: 'EXPEDITE',
        items: [
          { name: 'Kitchen printer check', qty: 1, mods: ['From POS'] },
          { name: 'Line test item', qty: 1, alert: true },
        ],
      }, restaurantId, { channel: 'auto', allowDialog: true });
      toast.success(method === 'dialog' ? 'Kitchen test — print preview' : 'Kitchen test sent', kitchenAssignment?.name || '');
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error('Kitchen test failed', msg);
    } finally {
      setBusy(false);
    }
  }

  async function testCashier() {
    setBusy(true);
    setError('');
    try {
      await prepareForPrint(cashierAssignment);
      const method = await printTest({
        restaurantName: restaurantName || 'Cafyz',
        restaurantId,
        logoUrl: undefined,
      }, { channel: 'auto' });
      toast.success(method === 'dialog' ? 'Cashier test — print preview' : 'Cashier test sent', cashierAssignment?.name || '');
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error('Cashier test failed', msg);
    } finally {
      setBusy(false);
    }
  }

  const channels = printerChannels();
  const bodyProps = {
    onClose,
    connectTarget,
    setConnectTarget,
    busy,
    error,
    live,
    env,
    kitchenAssignment,
    cashierAssignment,
    channels,
    onConnectBluetooth: () => void handleConnectBluetooth(),
    onConnectBle: () => void handleConnectBle(),
    onConnectClassic: (device: PairedPrinterDevice) => void handleConnectClassic(device),
    onConnectUSB: () => void handleConnectUSB(),
    pairedPrinters,
    loadingPaired,
    onReconnect: () => void handleReconnect(),
    onDisconnect: handleDisconnect,
    onTestKitchen: () => void testKitchen(),
    onTestCashier: () => void testCashier(),
    onClearAssignment: (role: PrinterRole) => void clearAssignment(role),
  };

  const card = (
    <motion.div
      initial={{ opacity: 0, y: modal ? 0 : 6, scale: modal ? 0.98 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={compact ? 'relative w-full rounded-xl p-3 mb-2' : 'rounded-xl p-3 w-full max-w-sm'}
      style={{
        background: '#0d1326',
        border: '1px solid rgba(30,127,255,0.2)',
        boxShadow: compact ? 'none' : '0 10px 40px rgba(0,0,0,0.55)',
        maxHeight: modal ? 'min(90dvh, 640px)' : undefined,
        overflowY: modal ? 'auto' : undefined,
      }}
    >
      <PanelBody {...bodyProps} />
    </motion.div>
  );

  if (modal && typeof document !== 'undefined') {
    return createPortal(
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3 sm:p-6"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        >
          <div onClick={e => e.stopPropagation()} className="w-full max-w-sm">
            {card}
          </div>
        </motion.div>
      </AnimatePresence>,
      document.body,
    );
  }

  return card;
}
