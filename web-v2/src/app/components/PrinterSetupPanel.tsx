import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Bluetooth, Loader2, Printer, ReceiptText, CreditCard, X } from 'lucide-react';
import { toast } from './Toast';
import { restaurantApi, type ApiRestaurant } from '../../services/api';
import {
  autoReconnectBluetooth, connectBluetooth, disconnectPrinter, printTest,
  printerChannels, printerStatus,
} from '../../services/PrintService';
import { getPrinterEnvironment } from '../../services/printerEnvironment';
import { isNativeApp } from '../../services/platformEnv';
import { PrinterHelpBanner } from './PrinterHelpBanner';

type PrinterRole = 'kitchen' | 'cashier';

interface Props {
  onClose?: () => void;
  kitchen?: string | null;
  cashier?: string | null;
  onRestaurantUpdate: (r: ApiRestaurant) => void;
  compact?: boolean;
  restaurantName?: string;
  restaurantId?: string;
  logoUrl?: string | null;
}

export function PrinterSetupPanel({ onClose, kitchen, cashier, onRestaurantUpdate, compact, restaurantName, restaurantId, logoUrl }: Props) {
  const [connectTarget, setConnectTarget] = useState<PrinterRole>('kitchen');
  const [busy, setBusy] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveName, setLiveName] = useState('');
  const env = getPrinterEnvironment();

  const refreshLive = useCallback(() => {
    setLiveConnected(printerChannels().bluetooth);
    const s = printerStatus();
    setLiveName(s.type === 'bluetooth' ? s.name : '');
  }, []);

  useEffect(() => { void autoReconnectBluetooth().finally(refreshLive); }, [refreshLive]);

  async function assignPrinter(role: PrinterRole, name: string) {
    const payload = role === 'kitchen'
      ? { kitchen_printer: { role: 'kitchen' as const, channel: 'bluetooth' as const, name } }
      : { cashier_printer: { role: 'cashier' as const, channel: 'bluetooth' as const, name } };
    onRestaurantUpdate(await restaurantApi.update(payload));
  }

  async function handleConnect() {
    setBusy(true);
    try {
      const name = await connectBluetooth();
      refreshLive();
      await assignPrinter(connectTarget, name);
      toast.success(`${connectTarget === 'kitchen' ? 'Kitchen' : 'Cashier'} connected`, name);
    } catch (e) {
      toast.error('Bluetooth failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    try {
      await printTest({ restaurantName: restaurantName || 'Cafyz', restaurantId, logoUrl: logoUrl ?? undefined });
      toast.success('Test sent', 'Check your thermal printer');
    } catch (e) {
      toast.error('Print failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={compact ? 'relative w-full rounded-xl p-3 mb-2' : 'absolute bottom-14 right-0 w-72 rounded-xl p-3 z-50'}
      style={{ background: '#0d1326', border: '1px solid rgba(30,127,255,0.2)', boxShadow: compact ? 'none' : '0 10px 30px rgba(0,0,0,0.5)' }}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5">
          <Printer size={13} style={{ color: '#1e7fff' }} />
          <span style={{ color: '#e8eef8', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8rem' }}>Printers</span>
        </div>
        {onClose && <button onClick={onClose} className="p-0.5" style={{ color: '#6b82a0' }}><X size={14} /></button>}
      </div>

      <PrinterHelpBanner />

      {isNativeApp() && (
        <p style={{ color: '#22c55e', fontSize: '0.62rem', marginBottom: 8, paddingInline: 2 }}>Native app — system Bluetooth picker</p>
      )}

      <div className="flex gap-1 mb-2 p-0.5 rounded-lg" style={{ background: 'rgba(30,127,255,0.06)' }}>
        {(['kitchen', 'cashier'] as const).map(role => (
          <button key={role} type="button" disabled={busy} onClick={() => setConnectTarget(role)}
            className="flex-1 py-1.5 rounded-md text-[0.68rem] font-semibold capitalize"
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
          { Icon: ReceiptText, role: 'Kitchen', name: kitchen },
          { Icon: CreditCard, role: 'Cashier', name: cashier },
        ].map(({ Icon, role, name }) => (
          <div key={role} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            style={{ background: 'rgba(30,127,255,0.05)', border: '1px solid rgba(30,127,255,0.08)' }}>
            <Icon size={14} style={{ color: '#1e7fff' }} />
            <div className="flex-1 min-w-0">
              <p style={{ color: '#6b82a0', fontSize: '0.6rem', textTransform: 'uppercase' }}>{role}</p>
              <p style={{ color: name ? '#e8eef8' : '#6b82a0', fontSize: '0.72rem' }} className="truncate">{name || 'Not configured'}</p>
            </div>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: name && liveConnected ? '#22c55e' : '#6b82a0' }} />
          </div>
        ))}
      </div>

      {env.canUseBluetooth && (
        <div className="space-y-1.5">
          <button type="button" disabled={busy} onClick={handleConnect}
            className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1e7fff, #00c6ff)', color: '#fff', opacity: busy ? 0.7 : 1 }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Bluetooth size={14} />}
            Connect {connectTarget}
          </button>
          {liveConnected && (
            <>
              <button type="button" disabled={busy} onClick={handleTest} className="w-full py-2 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(30,127,255,0.08)', color: '#1e7fff', border: '1px solid rgba(30,127,255,0.15)' }}>
                Test print
              </button>
              <button type="button" disabled={busy} onClick={() => { disconnectPrinter(); refreshLive(); }}
                className="w-full py-2 rounded-lg text-xs font-medium"
                style={{ background: 'rgba(255,59,92,0.08)', color: '#ff3b5c' }}>
                Disconnect {liveName || 'printer'}
              </button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
