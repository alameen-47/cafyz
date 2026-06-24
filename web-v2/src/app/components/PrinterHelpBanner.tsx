import { useEffect, useRef, useState } from 'react';
import { getPrinterEnvironment } from '../../services/printerEnvironment';
import { isNativeApp } from '../../services/platformEnv';
import './PrinterHelpBanner.css';

export function PrinterHelpBanner() {
  const env = getPrinterEnvironment();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  if (env.canUseBluetooth && !env.isStandalone && !isNativeApp()) return null;

  const isIos = env.platform === 'ios';
  const native = isNativeApp();

  const title = native
    ? 'Bluetooth printer tips'
    : isIos
      ? 'iPhone cannot use Bluetooth receipt printers'
      : env.isStandalone
        ? 'Home-screen app — Bluetooth tips'
        : 'Printer connection help';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div className="printer-help-wrap" ref={wrapRef}>
      <button
        type="button"
        className="printer-help-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Printer help information"
        title="Printer help"
      >
        i
      </button>
      {open && (
        <div className="printer-help-popover">
          <div className={`printer-help-banner ${isIos ? 'printer-help-banner--ios' : ''}`} role="note">
            <p className="printer-help-title">{title}</p>
            {isIos && (
              <p className="printer-help-lead">
                Switching to Chrome on iPhone will not help — Apple blocks Web Bluetooth for every browser on iOS, including iPhone 17 Pro.
              </p>
            )}
            <ul className="printer-help-list">
              {env.guidance.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {env.platform === 'android' && env.isStandalone && (
              <a
                className="printer-help-open-chrome"
                href={typeof window !== 'undefined' ? window.location.href : '/pos'}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Chrome browser →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
