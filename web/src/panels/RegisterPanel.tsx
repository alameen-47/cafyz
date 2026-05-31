import { useState } from 'react';
import { authApi } from '../services/api';
import './LoginPanel.css';

const TIMEZONES = [
  { label: 'UTC', value: 'UTC' },
  { label: 'Europe / Paris', value: 'Europe/Paris' },
  { label: 'Europe / London', value: 'Europe/London' },
  { label: 'America / New York', value: 'America/New_York' },
  { label: 'America / Chicago', value: 'America/Chicago' },
  { label: 'America / Los Angeles', value: 'America/Los_Angeles' },
  { label: 'Asia / Dubai', value: 'Asia/Dubai' },
  { label: 'Asia / Singapore', value: 'Asia/Singapore' },
  { label: 'Asia / Tokyo', value: 'Asia/Tokyo' },
  { label: 'Australia / Sydney', value: 'Australia/Sydney' },
];

export function RegisterPanel() {
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [existingEmail, setExistingEmail] = useState('');

  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName]           = useState('');
  const [email, setEmail]                   = useState('');
  const [password, setPassword]             = useState('');
  const [confirm, setConfirm]               = useState('');
  const [timezone, setTimezone]             = useState('UTC');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setExistingEmail('');

    if (!restaurantName.trim()) { setError('Restaurant name is required.'); return; }
    if (!ownerName.trim())      { setError('Your name is required.'); return; }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)   { setError('Passwords do not match.'); return; }

    setBusy(true);
    try {
      const data = await authApi.onboarding({ restaurant_name: restaurantName.trim(), owner_name: ownerName.trim(), email: email.trim(), password, timezone });
      localStorage.setItem('cafyz_token', data.token);

      const authUser = {
        id: data.user.id,
        name: data.user.name,
        initials: (data.user as { initials?: string }).initials ?? ownerName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2),
        email: data.user.email,
        role: 'owner',
        restaurant_id: data.restaurant.id,
        restaurant_name: data.restaurant.name,
        plan: 'basic',
        allowedScreens: ['pos', 'menu', 'waiter', 'license'],
      };
      localStorage.setItem('cafyz_user', JSON.stringify(authUser));
      setStep('done');
      setTimeout(() => { window.location.href = '/'; }, 1800);
    } catch (e) {
      const msg = (e as Error).message ?? 'Could not create account';
      setError(msg);
      if (msg.toLowerCase().includes('forgot password') || msg.toLowerCase().includes('already exists')) {
        setExistingEmail(email.trim().toLowerCase());
      }
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="login-root login-root--centered">
        <div className="login-card login-card--success">
          <div className="login-success-icon">🍽</div>
          <h2 className="serif" style={{ color: 'var(--text0)', marginBottom: 8 }}>You're all set!</h2>
          <p style={{ color: 'var(--text2)', fontSize: 14 }}>
            Your restaurant <b style={{ color: 'var(--text0)' }}>{restaurantName}</b> is ready.
            Taking you to the dashboard…
          </p>
          <p style={{ color: 'var(--gold)', fontSize: 12, marginTop: 16 }}>
            You're on the <b>Basic</b> plan. Activate a license key to unlock Pro or Premium features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-root login-root--centered">
      <div className="login-card">
        <div className="login-logo-row">
          <span className="login-logo-mark serif">C</span>
          <span className="login-logo-text serif">Cafyz</span>
        </div>
        <p className="login-tagline">Create your restaurant</p>

        <form onSubmit={handleSubmit} className="login-register-form">
          <div>
            <label className="login-label">Restaurant name</label>
            <input
              className="login-input"
              placeholder="Saint Paris 6e"
              value={restaurantName}
              onChange={e => setRestaurantName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="login-label">Your name</label>
            <input
              className="login-input"
              placeholder="Mireille Vasseur"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="login-label">Email</label>
            <input
              className="login-input"
              type="email"
              placeholder="owner@restaurant.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-grid-2">
            <div>
              <label className="login-label">Password</label>
              <input
                className="login-input"
                type="password"
                placeholder="Min 8 chars"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="login-label">Confirm</label>
              <input
                className="login-input"
                type="password"
                placeholder="Repeat"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="login-label">Timezone</label>
            <select
              className="login-input"
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="login-error">{error}</p>}
          {existingEmail && (
            <p className="login-register-signin">
              Account already exists.{' '}
              <a href={`/login?mode=forgot&email=${encodeURIComponent(existingEmail)}`}>
                Reset password →
              </a>
            </p>
          )}

          <button type="submit" className="login-btn" disabled={busy}>
            {busy ? 'Creating your restaurant…' : 'Create Restaurant & Sign In'}
          </button>
        </form>

        <p className="login-register-note">
          New accounts start on the <b>Basic</b> plan (free).
          Activate a license key to upgrade.
        </p>

        <div className="login-divider" />

        <p className="login-register-signin">
          Already have an account?{' '}
          <a href="/login">Sign in →</a>
        </p>
      </div>
    </div>
  );
}
