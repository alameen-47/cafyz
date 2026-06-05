import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { toastBus } from '../services/toastBus';
import './LoginPanel.css';

// Post-login navigation uses a full-page reload instead of React Router navigate()
// to avoid a timing race where RequireAuth/RequireFounder reads stale user context
// before the setUser() state update has been flushed.
function goTo(path: string) {
  window.location.href = path;
}

function getOrCreateDeviceId(): string {
  const key = 'cafyz_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `cafyz-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, generated);
  return generated;
}

export function LoginPanel() {
  const { login, requestLoginOtp, loginWithOtp, loginWithPin, error, clearError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [method, setMethod] = useState<'otp' | 'email'>('otp');
  const [mobileMethod, setMobileMethod] = useState<'email' | 'pin'>('email');
  const [email, setEmail] = useState('');
  const [pinEmail, setPinEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [pin, setPin] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [localMsg, setLocalMsg] = useState('');

  const displayError = localErr || error;

  function switchMethod(next: 'otp' | 'email') {
    setMethod(next);
    setLocalErr('');
    setLocalMsg('');
    clearError();
  }

  async function handleEmailLogin() {
    if (!email.trim()) {
      setLocalErr('Enter your work email.');
      return;
    }
    if (!password.trim()) {
      setLocalErr('Enter your password.');
      return;
    }
    setBusy(true);
    setLocalErr('');
    setLocalMsg('');
    clearError();
    try {
      await login(email, password, getOrCreateDeviceId());
      toastBus.success('Signed in successfully');
      const stored = JSON.parse(localStorage.getItem('cafyz_user') ?? '{}') as { role?: string };
      goTo(stored.role === 'founder' ? '/founder' : '/');
    } catch (e) {
      setLocalErr((e as Error).message ?? 'Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp() {
    if (!phone.trim()) {
      setLocalErr('Enter your phone number.');
      return;
    }
    setBusy(true);
    setLocalErr('');
    setLocalMsg('');
    clearError();
    try {
      const data = await requestLoginOtp(phone);
      setOtpSent(true);
      setLocalMsg(data.devOtp ? `${data.message} (Dev OTP: ${data.devOtp})` : data.message);
      toastBus.success('OTP sent. Check your phone.');
    } catch (e) {
      setLocalErr((e as Error).message ?? 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpSent) {
      setLocalErr('Request OTP first.');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      setLocalErr('Enter the 6-digit OTP code.');
      return;
    }
    setBusy(true);
    setLocalErr('');
    clearError();
    try {
      await loginWithOtp(phone, otp.trim());
      toastBus.success('OTP verified. Welcome back.');
      const stored = JSON.parse(localStorage.getItem('cafyz_user') ?? '{}') as { role?: string };
      goTo(stored.role === 'founder' ? '/founder' : '/');
    } catch (e) {
      setLocalErr((e as Error).message ?? 'Could not verify OTP');
    } finally {
      setBusy(false);
    }
  }

  const handlePin = (key: number | 'back' | null) => {
    if (key === null || busy) return;
    if (!pinEmail.trim()) {
      setLocalErr('Enter your work email before using PIN login.');
      return;
    }
    if (key === 'back') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = [...pin, key];
    setPin(next);
    if (next.length === 4) {
      setBusy(true);
      setLocalErr('');
      loginWithPin(pinEmail.trim(), next.join(''), getOrCreateDeviceId())
        .then(() => {
          toastBus.success('PIN login successful');
          const stored = JSON.parse(localStorage.getItem('cafyz_user') ?? '{}') as { role?: string };
          goTo(stored.role === 'founder' ? '/founder' : '/');
        })
        .catch(e => {
          setLocalErr((e as Error).message ?? 'Invalid PIN');
          setPin([]);
          setBusy(false);
        });
    }
  };

  return (
    <div className="login-root">
      {/* Theme toggle — top right corner */}
      <button
        className="login-theme-toggle theme-toggle"
        onClick={toggleTheme}
        title={
          theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
        }
      >
        {theme === 'dark' ? '☀︎' : '◗'}
      </button>

      {/* ── Desktop left pane ─────────────────────────────────────── */}
      <section className="login-left">
        <div className="login-brand">
          <div className="login-logo">C</div>
          <div>
            <p className="serif login-brand-name">Cafyz</p>
            <p className="mono login-brand-sub">
              RESTAURANT MANAGEMENT SOLUTIONS
            </p>
          </div>
        </div>
        <div className="login-stats">
          <div>
            <p className="login-stat-n serif">240+</p>
            <p className="login-stat-l">Restaurants</p>
          </div>
          <div>
            <p className="login-stat-n serif">11</p>
            <p className="login-stat-l">Countries</p>
          </div>
          <div>
            <p className="login-stat-n serif">99.99</p>
            <p className="login-stat-l">Uptime · %</p>
          </div>
        </div>
        <div className="login-hero">
          <p className="eyebrow">Restaurant Operations</p>
          <h1 className="serif">
            Run the room
            <br />
            like it&apos;s <em>your kitchen</em>.
          </h1>
          <p className="login-hero-sub">
            Cafyz is the restaurant management platform used by 240+
            restaurants, unifying POS, kitchen, staffing, and back-office
            workflows in one system.
          </p>
        </div>
      </section>

      {/* ── Desktop right pane ────────────────────────────────────── */}
      <section className="login-right">
        <p className="eyebrow">Sign In · Restaurant Management</p>
        <h2 className="serif login-title">Welcome back.</h2>
        <p className="login-sub">
          Sign in using phone OTP or email and password.
        </p>

        <div className="login-method-switch">
          <button
            type="button"
            className="login-link-btn"
            onClick={() => switchMethod('otp')}
            disabled={method === 'otp' || busy}
          >
            Phone OTP
          </button>
          <button
            type="button"
            className="login-link-btn"
            onClick={() => switchMethod('email')}
            disabled={method === 'email' || busy}
          >
            Email Login
          </button>
        </div>

        {method === 'otp' ? (
          <>
            <label className="login-field">
              <span>Phone number</span>
              <input
                type="tel"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value);
                  setLocalErr('');
                  clearError();
                }}
                onKeyDown={e => e.key === 'Enter' && (otpSent ? handleVerifyOtp() : handleSendOtp())}
                placeholder="+971500000000"
              />
            </label>
            <label className="login-field">
              <span>One-time password (OTP)</span>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                placeholder="6-digit code"
                disabled={!otpSent}
              />
            </label>
          </>
        ) : (
          <>
            <label className="login-field">
              <span>Work email</span>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setLocalErr('');
                  clearError();
                }}
                onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                placeholder="owner@restaurant.com"
              />
            </label>
            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                placeholder="••••••••"
              />
            </label>
          </>
        )}

        {displayError && <p className="login-error">{displayError}</p>}
        {localMsg && <p className="login-success-message">{localMsg}</p>}

        <button
          type="button"
          className="login-submit"
          onClick={method === 'otp' ? (otpSent ? handleVerifyOtp : handleSendOtp) : handleEmailLogin}
          disabled={busy}
        >
          {method === 'otp'
            ? (busy ? (otpSent ? 'Verifying…' : 'Sending OTP…') : otpSent ? 'Verify OTP & Enter Cafyz →' : 'Send OTP')
            : (busy ? 'Signing in…' : 'Sign in with Email →')}
        </button>

        <div className="login-secondary-links">
          {method === 'otp' && otpSent && (
            <button
              type="button"
              className="login-link-btn"
              onClick={handleSendOtp}
              disabled={busy}
            >
              Resend OTP
            </button>
          )}
        </div>

        {/* ── Get Account link ─────────────────────────────────────── */}
        <div className="login-get-account-bar">
          <span>New to Cafyz?</span>
          <a href="/get-account?intent=trial&plan=premium" className="login-get-account-link">
            Trial Request →
          </a>
          <a href="/get-account?intent=purchase" className="login-get-account-link login-get-account-link-alt">
            Purchase Plan →
          </a>
        </div>
      </section>

      {/* ── Mobile PIN pane ────────────────────────────────────────── */}
      <section
        className="login-mobile-only"
        style={{ display: undefined }}
      >
        <div className="login-mobile-head">
          <div className="login-logo">C</div>
          <p className="serif">Cafyz</p>
        </div>
        <p className="eyebrow">Restaurant Operations · Welcome</p>
        <h2 className="serif">
          Good evening, <em>team.</em>
        </h2>
        <div className="login-method-switch login-method-switch-mobile">
          <button
            type="button"
            className="login-link-btn"
            onClick={() => setMobileMethod('email')}
            disabled={mobileMethod === 'email' || busy}
          >
            Email Login
          </button>
          <button
            type="button"
            className="login-link-btn"
            onClick={() => setMobileMethod('pin')}
            disabled={mobileMethod === 'pin' || busy}
          >
            PIN Login
          </button>
        </div>

        {mobileMethod === 'email' ? (
          <>
            <label className="login-field" style={{ marginTop: 12 }}>
              <span>Work email</span>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setLocalErr('');
                  clearError();
                }}
                placeholder="owner@restaurant.com"
              />
            </label>
            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            <button type="button" className="login-submit" onClick={handleEmailLogin} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in with Email →'}
            </button>
          </>
        ) : (
          <>
            <label className="login-field" style={{ marginTop: 12 }}>
              <span>Work email (required for PIN)</span>
              <input
                type="email"
                value={pinEmail}
                onChange={e => {
                  setPinEmail(e.target.value);
                  setLocalErr('');
                  clearError();
                }}
                placeholder="staff@restaurant.com"
              />
            </label>
            <p className="login-pin-label">PIN · 4 digits</p>
            <div className="login-pin-dots">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={pin.length > i ? 'filled' : ''} />
              ))}
            </div>
            <div className="login-numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'back'].map((k, i) => (
                <button
                  key={i}
                  type="button"
                  className={k === null ? 'hidden' : ''}
                  disabled={k === null || busy}
                  onClick={() =>
                    handlePin(
                      k === 'back' ? 'back' : k === null ? null : (k as number),
                    )
                  }
                >
                  {k === 'back' ? '⌫' : k}
                </button>
              ))}
            </div>
          </>
        )}
        {localErr && (
          <p className="login-error" style={{ textAlign: 'center' }}>
            {localErr}
          </p>
        )}
      </section>
    </div>
  );
}
