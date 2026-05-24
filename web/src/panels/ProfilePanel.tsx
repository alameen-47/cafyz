import { useState, useEffect, useRef } from 'react';
import { restaurantApi, type ApiRestaurant } from '../services/api';
import {
  connectBluetooth, connectUSB, disconnectPrinter,
  print as printReceipt, savePrinterPrefs, tryAutoReconnect,
  type ReceiptData,
} from '../services/PrintService';
import './ProfilePanel.css';

export function ProfilePanel() {
  // ── Profile state ──────────────────────────────────────────────────────────
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saveState,  setSaveState]  = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveMsg,    setSaveMsg]    = useState('');

  const [name,     setName]     = useState('');
  const [logo,     setLogo]     = useState<string | null>(null);
  const [line1,    setLine1]    = useState('');
  const [line2,    setLine2]    = useState('');
  const [city,     setCity]     = useState('');
  const [postcode, setPostcode] = useState('');
  const [country,  setCountry]  = useState('');
  const [phone,    setPhone]    = useState('');
  const [website,  setWebsite]  = useState('');

  // ── Printer state ──────────────────────────────────────────────────────────
  const [printer,     setPrinter]     = useState<{ type: 'none' | 'bluetooth' | 'usb'; name: string }>({ type: 'none', name: '' });
  const [printerBusy, setPrinterBusy] = useState(false);
  const [printerErr,  setPrinterErr]  = useState('');
  const [showConnect, setShowConnect] = useState(false);
  const [printing,    setPrinting]    = useState(false);
  const [printState,  setPrintState]  = useState<'idle' | 'ok' | 'error'>('idle');
  const [printMsg,    setPrintMsg]    = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-reconnect saved printer on mount
  useEffect(() => {
    tryAutoReconnect().then(s => { if (s.type !== 'none') setPrinter(s); }).catch(() => {});
  }, []);

  // Load restaurant profile on mount
  useEffect(() => {
    restaurantApi.me()
      .then((r: ApiRestaurant) => {
        setName(r.name ?? '');
        setLogo(r.logo ?? null);
        setLine1(r.address_line1 ?? '');
        setLine2(r.address_line2 ?? '');
        setCity(r.city ?? '');
        setPostcode(r.postcode ?? '');
        setCountry(r.country ?? '');
        setPhone(r.phone ?? '');
        setWebsite(r.website ?? '');
      })
      .catch(e => { setSaveMsg(e.message); setSaveState('error'); })
      .finally(() => setLoading(false));
  }, []);

  // ── Logo upload ────────────────────────────────────────────────────────────
  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { setSaveMsg('Logo must be under 500 KB.'); setSaveState('error'); return; }
    const reader = new FileReader();
    reader.onload = () => { setLogo(reader.result as string); setSaveState('idle'); };
    reader.readAsDataURL(file);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) { setSaveMsg('Restaurant name is required.'); setSaveState('error'); return; }
    setSaving(true); setSaveState('idle'); setSaveMsg('');
    try {
      await restaurantApi.update({ name: name.trim(), logo, address_line1: line1, address_line2: line2, city, postcode, country, phone, website });
      setSaveState('saved'); setSaveMsg('Profile saved successfully.');
      setTimeout(() => setSaveState('idle'), 4000);
    } catch (e) {
      setSaveState('error'); setSaveMsg((e as Error).message || 'Save failed — please try again.');
    } finally { setSaving(false); }
  }

  // ── Printer connect/disconnect ────────────────────────────────────────────
  async function handleConnectBluetooth() {
    setPrinterBusy(true); setPrinterErr(''); setShowConnect(false);
    try {
      const n = await connectBluetooth();
      setPrinter({ type: 'bluetooth', name: n }); savePrinterPrefs('bluetooth', n);
    } catch (e) { setPrinterErr((e as Error).message); }
    finally { setPrinterBusy(false); }
  }

  async function handleConnectUSB() {
    setPrinterBusy(true); setPrinterErr(''); setShowConnect(false);
    try {
      const n = await connectUSB();
      setPrinter({ type: 'usb', name: n }); savePrinterPrefs('usb', n);
    } catch (e) { setPrinterErr((e as Error).message); }
    finally { setPrinterBusy(false); }
  }

  function handleDisconnect() {
    disconnectPrinter(); setPrinter({ type: 'none', name: '' }); savePrinterPrefs('none', '');
  }

  // ── Test print ─────────────────────────────────────────────────────────────
  async function handleTestPrint() {
    setPrinting(true); setPrintState('idle'); setPrintMsg('');
    const addrParts = [line1, line2, city, postcode, country].filter(Boolean);
    const receiptData: ReceiptData = {
      restaurantName:    name || 'My Restaurant',
      restaurantLogo:    logo,
      restaurantAddress: addrParts.length ? addrParts.join(', ') : undefined,
      restaurantPhone:   phone || undefined,
      restaurantWebsite: website || undefined,
      tableName:         'T3',
      serverName:        'Sara',
      covers:            2,
      items: [
        { name: 'Dry-Aged Ribeye 300g', qty: 2, price: 52 },
        { name: 'Negroni',              qty: 1, price: 13 },
        { name: 'Crème Brûlée',        qty: 2, price: 10 },
      ],
      subtotal: 137,
      service:  24.66,
      tax:      11.99,
      total:    173.65,
      payMethod: 'Test Print',
      dateStr:  new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    try {
      const method = await printReceipt(receiptData);
      setPrintState('ok');
      setPrintMsg(method === 'dialog' ? 'Browser print dialog opened.' : `Sent to ${printer.name}.`);
      setTimeout(() => setPrintState('idle'), 4000);
    } catch (e) {
      setPrintState('error'); setPrintMsg((e as Error).message);
    } finally { setPrinting(false); }
  }

  // ── Preview address ────────────────────────────────────────────────────────
  const previewAddr = [line1, line2, city, postcode, country].filter(Boolean).join(', ');

  if (loading) return (
    <div className="profile-root"><p className="profile-loading">Loading profile…</p></div>
  );

  return (
    <div className="profile-root">
      <div className="profile-card">

        {/* ── Title ────────────────────────────────────────────────────── */}
        <div className="profile-header">
          <div>
            <h2 className="serif profile-title">Restaurant Profile</h2>
            <p className="profile-sub">Logo and address appear on every printed receipt.</p>
          </div>
          <button
            type="button"
            className={`profile-save-btn${saving ? ' loading' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="profile-spinner" /> : null}
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>

        {saveState === 'saved' && <p className="profile-banner profile-banner-ok">✓ {saveMsg}</p>}
        {saveState === 'error' && <p className="profile-banner profile-banner-err">✕ {saveMsg}</p>}

        {/* ── Logo + name ────────────────────────────────────────────── */}
        <div className="profile-logo-row">
          <div
            className={`profile-logo-box${logo ? ' has-logo' : ''}`}
            onClick={() => fileRef.current?.click()}
            title="Click to upload logo"
          >
            {logo
              ? <img src={logo} alt="Logo" />
              : <div className="profile-logo-empty"><span>+</span><small>Logo</small></div>
            }
          </div>
          <div className="profile-logo-meta">
            <label className="profile-field profile-field-full">
              <span>Restaurant Name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your restaurant name" />
            </label>
            <div className="profile-logo-btns">
              <button type="button" className="pf-btn-sm" onClick={() => fileRef.current?.click()}>
                {logo ? 'Change logo' : 'Upload logo'}
              </button>
              {logo && <button type="button" className="pf-btn-sm danger" onClick={() => setLogo(null)}>Remove</button>}
              <span className="profile-logo-hint">PNG/JPG · max 500 KB</span>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} onChange={handleLogoFile} />
        </div>

        <hr className="profile-divider" />

        {/* ── Contact ───────────────────────────────────────────────── */}
        <div className="profile-section-label eyebrow">Contact · Printed on receipts</div>
        <div className="profile-grid">
          <label className="profile-field">
            <span>Phone</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 20 7123 4567" />
          </label>
          <label className="profile-field">
            <span>Website</span>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="www.yourrestaurant.com" />
          </label>
        </div>

        <hr className="profile-divider" />

        {/* ── Address ───────────────────────────────────────────────── */}
        <div className="profile-section-label eyebrow">Address · Printed on receipts</div>
        <div className="profile-grid">
          <label className="profile-field profile-field-full">
            <span>Address Line 1</span>
            <input value={line1} onChange={e => setLine1(e.target.value)} placeholder="12 Restaurant Street" />
          </label>
          <label className="profile-field profile-field-full">
            <span>Address Line 2 <em>(optional)</em></span>
            <input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Floor 2, Suite 3" />
          </label>
          <label className="profile-field">
            <span>City</span>
            <input value={city} onChange={e => setCity(e.target.value)} placeholder="London" />
          </label>
          <label className="profile-field">
            <span>Postcode</span>
            <input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="SW1A 1AA" />
          </label>
          <label className="profile-field profile-field-full">
            <span>Country</span>
            <input value={country} onChange={e => setCountry(e.target.value)} placeholder="United Kingdom" />
          </label>
        </div>

        <hr className="profile-divider" />

        {/* ── Printer ───────────────────────────────────────────────── */}
        <div className="profile-section-label eyebrow">Printer · Receipt Output</div>

        <div className="profile-printer-row">
          <div className={`profile-printer-status ${printer.type !== 'none' ? 'connected' : ''}`}>
            <span className="printer-dot" />
            <div>
              <p className="printer-name">
                {printer.type === 'none' ? 'No printer connected' : printer.name}
              </p>
              <p className="printer-type">
                {printer.type === 'none' ? 'Use browser print dialog as fallback'
                  : printer.type === 'bluetooth' ? 'Bluetooth thermal printer'
                  : 'USB thermal printer'}
              </p>
            </div>
          </div>

          <div className="profile-printer-btns">
            {printer.type !== 'none' ? (
              <button type="button" className="pf-btn-sm danger" onClick={handleDisconnect} disabled={printerBusy}>
                Disconnect
              </button>
            ) : (
              <div className="profile-connect-wrap">
                <button type="button" className="pf-btn-sm" onClick={() => setShowConnect(p => !p)} disabled={printerBusy}>
                  {printerBusy ? 'Connecting…' : 'Connect printer'}
                </button>
                {showConnect && (
                  <div className="profile-connect-menu">
                    <button type="button" onClick={handleConnectBluetooth}>
                      <span>📶</span> Bluetooth
                    </button>
                    <button type="button" onClick={handleConnectUSB}>
                      <span>🔌</span> USB
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className={`pf-btn-test${printing ? ' loading' : ''}${printState === 'ok' ? ' ok' : ''}${printState === 'error' ? ' err' : ''}`}
              onClick={handleTestPrint}
              disabled={printing}
            >
              {printing
                ? <><span className="profile-spinner sm" /> Printing…</>
                : printState === 'ok'   ? '✓ Printed'
                : printState === 'error'? '✕ Failed'
                : '🖨 Test Print'}
            </button>
          </div>
        </div>

        {printerErr && <p className="profile-banner profile-banner-err">✕ {printerErr}</p>}
        {printState === 'ok'    && <p className="profile-banner profile-banner-ok">✓ {printMsg}</p>}
        {printState === 'error' && <p className="profile-banner profile-banner-err">✕ {printMsg}</p>}

        <hr className="profile-divider" />

        {/* ── Receipt preview ───────────────────────────────────────── */}
        <div className="profile-section-label eyebrow">Receipt Preview · Live</div>
        <div className="profile-preview-wrap">
          <div className="profile-receipt">
            {logo && <img src={logo} alt="logo" className="rp-logo" />}
            <p className="rp-name serif">{name || 'Restaurant Name'}</p>
            {previewAddr && <p className="rp-meta">{previewAddr}</p>}
            {phone   && <p className="rp-meta">Tel: {phone}</p>}
            {website && <p className="rp-meta">{website}</p>}
            <div className="rp-divider" />
            <p className="rp-meta">Table: T3 · Server: Sara · 2 covers</p>
            <div className="rp-divider" />
            <div className="rp-row"><span>2× Dry-Aged Ribeye</span><span>$104.00</span></div>
            <div className="rp-row"><span>1× Negroni</span><span>$13.00</span></div>
            <div className="rp-row"><span>2× Crème Brûlée</span><span>$20.00</span></div>
            <div className="rp-divider" />
            <div className="rp-row"><span>Subtotal</span><span>$137.00</span></div>
            <div className="rp-row"><span>Service 18%</span><span>$24.66</span></div>
            <div className="rp-row"><span>Tax 8.75%</span><span>$11.99</span></div>
            <div className="rp-divider" />
            <div className="rp-row rp-total"><span>TOTAL DUE</span><span>$173.65</span></div>
            <div className="rp-divider" />
            <p className="rp-meta rp-center">Thank you for your visit!</p>
            <p className="rp-meta rp-center">{website || 'cafyz.com'}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
