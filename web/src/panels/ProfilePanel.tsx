import { useState, useEffect, useRef } from 'react';
import { restaurantApi, type ApiRestaurant } from '../services/api';
import './ProfilePanel.css';

export function ProfilePanel() {
  const [, setRestaurant] = useState<ApiRestaurant | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState('');

  // Form fields
  const [name,    setName]    = useState('');
  const [logo,    setLogo]    = useState<string | null>(null);
  const [line1,   setLine1]   = useState('');
  const [line2,   setLine2]   = useState('');
  const [city,    setCity]    = useState('');
  const [postcode,setPostcode]= useState('');
  const [country, setCountry] = useState('');
  const [phone,   setPhone]   = useState('');
  const [website, setWebsite] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    restaurantApi.me()
      .then(r => {
        setRestaurant(r);
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
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { setError('Logo must be under 500 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!name.trim()) { setError('Restaurant name is required.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await restaurantApi.update({
        name: name.trim(),
        logo,
        address_line1: line1,
        address_line2: line2,
        city,
        postcode,
        country,
        phone,
        website,
      });
      setRestaurant(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="profile-root">
      <p className="profile-loading">Loading profile…</p>
    </div>
  );

  return (
    <div className="profile-root">
      <div className="profile-card">
        <h2 className="serif profile-title">Restaurant Profile</h2>
        <p className="profile-sub">This information appears on every printed receipt.</p>

        {/* Logo */}
        <div className="profile-logo-section">
          <div
            className="profile-logo-preview"
            onClick={() => fileRef.current?.click()}
            title="Click to upload logo"
          >
            {logo
              ? <img src={logo} alt="Restaurant logo" />
              : <span className="profile-logo-placeholder">Upload Logo</span>
            }
          </div>
          <div className="profile-logo-actions">
            <button type="button" className="profile-btn-secondary" onClick={() => fileRef.current?.click()}>
              {logo ? 'Change logo' : 'Upload logo'}
            </button>
            {logo && (
              <button type="button" className="profile-btn-danger" onClick={() => setLogo(null)}>
                Remove
              </button>
            )}
            <p className="profile-logo-hint">PNG or JPG · max 500 KB · will print on receipts</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={handleLogoFile}
          />
        </div>

        <hr className="profile-divider" />

        {/* Basic info */}
        <div className="profile-section-label eyebrow">Restaurant Details</div>
        <div className="profile-grid">
          <label className="profile-field profile-field-full">
            <span>Restaurant Name</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your restaurant name" />
          </label>
          <label className="profile-field">
            <span>Phone</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 20 1234 5678" />
          </label>
          <label className="profile-field">
            <span>Website</span>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="www.yourrestaurant.com" />
          </label>
        </div>

        <hr className="profile-divider" />

        {/* Address */}
        <div className="profile-section-label eyebrow">Address · Printed on receipts</div>
        <div className="profile-grid">
          <label className="profile-field profile-field-full">
            <span>Address Line 1</span>
            <input value={line1} onChange={e => setLine1(e.target.value)} placeholder="12 Restaurant Street" />
          </label>
          <label className="profile-field profile-field-full">
            <span>Address Line 2</span>
            <input value={line2} onChange={e => setLine2(e.target.value)} placeholder="Floor 2, Suite 3 (optional)" />
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

        {error && <p className="profile-error">{error}</p>}
        {saved && <p className="profile-success">Profile saved successfully.</p>}

        <div className="profile-actions">
          <button
            type="button"
            className="profile-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>

        {/* Receipt preview */}
        <hr className="profile-divider" />
        <div className="profile-section-label eyebrow">Receipt Preview</div>
        <div className="profile-receipt-preview">
          {logo && <img src={logo} alt="logo" className="receipt-preview-logo" />}
          <p className="receipt-preview-name serif">{name || 'Restaurant Name'}</p>
          {(line1 || city) && (
            <p className="receipt-preview-addr">
              {[line1, line2, city, postcode, country].filter(Boolean).join(', ')}
            </p>
          )}
          {phone   && <p className="receipt-preview-addr">Tel: {phone}</p>}
          {website && <p className="receipt-preview-addr">{website}</p>}
          <p className="receipt-preview-addr" style={{ marginTop: 8 }}>Table: T3 · Server: Sara · 2 covers</p>
          <div className="receipt-preview-divider" />
          <div className="receipt-preview-row"><span>2× Ribeye</span><span>$104.00</span></div>
          <div className="receipt-preview-row"><span>1× Negroni</span><span>$13.00</span></div>
          <div className="receipt-preview-divider" />
          <div className="receipt-preview-row"><span>Subtotal</span><span>$117.00</span></div>
          <div className="receipt-preview-row"><span>Service 18%</span><span>$21.06</span></div>
          <div className="receipt-preview-row"><span>Tax 8.75%</span><span>$10.24</span></div>
          <div className="receipt-preview-divider" />
          <div className="receipt-preview-row receipt-preview-total"><span>TOTAL DUE</span><span>$148.30</span></div>
          <div className="receipt-preview-divider" />
          <p className="receipt-preview-addr" style={{ textAlign: 'center', marginTop: 6 }}>
            Thank you for your visit!
          </p>
          <p className="receipt-preview-addr" style={{ textAlign: 'center' }}>
            {website || 'cafyz.com'}
          </p>
        </div>
      </div>
    </div>
  );
}
