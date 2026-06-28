import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { printerStatus } from '../../services/PrintService';

type PrinterRole = 'kitchen' | 'cashier';
type Status = 'none' | 'configured' | 'connected';

function roleStatus(
  assignedName: string | null | undefined,
  live: ReturnType<typeof printerStatus>,
  channel: 'bluetooth' | 'usb' = 'bluetooth',
): Status {
  if (!assignedName) return 'none';
  if (live.type === 'none') return 'configured';
  if (live.type !== channel) return 'configured';
  const liveName = live.name.trim().toLowerCase();
  const assignedNameNorm = assignedName.trim().toLowerCase();
  if (!liveName || liveName === assignedNameNorm || assignedNameNorm.includes(liveName) || liveName.includes(assignedNameNorm)) {
    return 'connected';
  }
  return 'configured';
}

const LABEL: Record<Status, string> = {
  none: 'Not set',
  configured: 'Ready',
  connected: 'Connected',
};

const COLOR: Record<Status, string> = {
  none: 'var(--cafyz-muted)',
  configured: '#f59e0b',
  connected: '#22c55e',
};

/** Compact kitchen/cashier printer status for POS bill sheet — no configuration UI. */
export function PrinterStatusBadge({
  kitchen,
  cashier,
}: {
  kitchen?: string | null;
  cashier?: string | null;
}) {
  const [live, setLive] = useState(printerStatus);

  useEffect(() => {
    const tick = () => setLive(printerStatus());
    tick();
    const id = window.setInterval(tick, 2500);
    return () => window.clearInterval(id);
  }, []);

  const rows: { role: PrinterRole; name: string | null | undefined }[] = [
    { role: 'kitchen', name: kitchen },
    { role: 'cashier', name: cashier },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-2.5 py-2 rounded-xl"
      style={{ background: 'var(--cafyz-surface)', border: '1px solid var(--cafyz-border)' }}
    >
      <Printer size={13} style={{ color: '#1e7fff', flexShrink: 0 }} />
      {rows.map(({ role, name }) => {
        const status = roleStatus(name, live);
        return (
          <div key={role} className="flex items-center gap-1.5 text-xs">
            <span style={{ color: 'var(--cafyz-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{role}</span>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COLOR[status] }} />
            <span style={{ color: COLOR[status], fontWeight: 600 }}>{LABEL[status]}</span>
          </div>
        );
      })}
    </div>
  );
}
