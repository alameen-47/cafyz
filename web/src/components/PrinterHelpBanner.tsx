import { getPrinterEnvironment } from '../services/printerEnvironment';

export function PrinterHelpBanner() {
  const env = getPrinterEnvironment();

  if (env.canUseBluetooth && !env.isStandalone) return null;

  const isIos = env.platform === 'ios';

  const title = isIos
    ? 'iPhone cannot use Bluetooth receipt printers'
    : env.isStandalone
      ? 'Home-screen app — Bluetooth tips'
      : 'Printer connection help';

  return (
    <div className={`printer-help-banner ${isIos ? 'printer-help-banner--ios' : ''}`} role="alert">
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
  );
}
