import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toastBus } from '../services/toastBus';
import './QrMenuCard.css';

/**
 * Owner-facing card that renders a scannable QR code linking to this
 * restaurant's public customer menu (/m/:restaurantId). Print it for tables.
 */
export function QrMenuCard({ restaurantId, restaurantName }: { restaurantId: string; restaurantName?: string }) {
  const [dataUrl, setDataUrl] = useState('');
  const menuUrl = `${window.location.origin}/m/${restaurantId}`;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(menuUrl, {
      width: 520,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B1220', light: '#FFFFFF' },
    })
      .then(url => { if (alive) setDataUrl(url); })
      .catch(() => { if (alive) setDataUrl(''); });
    return () => { alive = false; };
  }, [menuUrl]);

  function downloadPng() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${(restaurantName || 'menu').replace(/\s+/g, '-').toLowerCase()}-menu-qr.png`;
    a.click();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(menuUrl);
      toastBus.success('Menu link copied');
    } catch {
      toastBus.error('Could not copy link');
    }
  }

  return (
    <div className="qr-card card">
      <div className="qr-card-info">
        <p className="eyebrow">Customer QR Menu</p>
        <h3 className="qr-card-title serif">Scan to view the menu</h3>
        <p className="qr-card-sub">
          Print this code for your tables, window, or receipts. Guests scan it to browse
          your live menu instantly — no app, no login.
        </p>
        <div className="qr-card-url" title={menuUrl}>
          <span className="mono">{menuUrl}</span>
        </div>
        <div className="qr-card-actions">
          <button type="button" className="btn-gold" onClick={downloadPng} disabled={!dataUrl}>
            ⬇ Download PNG
          </button>
          <button type="button" className="btn-outline" onClick={copyLink}>
            Copy link
          </button>
          <a className="btn-outline qr-card-open" href={menuUrl} target="_blank" rel="noreferrer">
            Open ↗
          </a>
        </div>
      </div>
      <div className="qr-card-code">
        {dataUrl
          ? <img src={dataUrl} alt="Customer menu QR code" />
          : <div className="qr-card-loading">Generating…</div>}
      </div>
    </div>
  );
}
