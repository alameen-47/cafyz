import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './LoginPanel.css';

// Post-login navigation uses a full-page reload instead of React Router navigate()
// to avoid a timing race where RequireAuth/RequireFounder reads stale user context
// before the setUser() state update has been flushed.
function goTo(path: string) { window.location.href = path; }

export function LoginPanel() {
  const { login, loginWithPin, error, clearError } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [pin,      setPin]      = useState<number[]>([]);
  const [busy,     setBusy]     = useState(false);
  const [localErr, setLocalErr] = useState('');

  const displayError = localErr || error;

  async function handleLogin() {
    if (!email.trim()) { setLocalErr('Enter your work email.'); return; }
    setBusy(true); setLocalErr(''); clearError();
    try {
      await login(email, password);
      const stored = JSON.parse(localStorage.getItem('cafyz_user') ?? '{}') as { role?: string };
      goTo(stored.role === 'founder' ? '/founder' : '/');
    } catch (e) {
      setLocalErr((e as Error).message ?? 'Login failed');
      setBusy(false);
    }
  }

  const handlePin = (key: number | 'back' | null) => {
    if (key === null || busy) return;
    if (key === 'back') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = [...pin, key];
    setPin(next);
    if (next.length === 4) {
      setBusy(true); setLocalErr('');
      loginWithPin(next.join(''))
        .then(() => goTo('/'))
        .catch(e => { setLocalErr((e as Error).message ?? 'Invalid PIN'); setPin([]); setBusy(false); });
    }
  };

  return (
    <div className="login-root">
      {/* Theme toggle — top right corner */}
      <button
        className="login-theme-toggle theme-toggle"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? '☀︎' : '◗'}
      </button>

      {/* ── Desktop left pane ─────────────────────────────────────── */}
      <section className="login-left">
        <div className="login-brand">
          <div className="login-logo">C</div>
          <div>
            <p className="serif login-brand-name">Cafyz</p>
            <p className="mono login-brand-sub">HOSPITALITY OS</p>
          </div>
        </div>
        <div className="login-stats">
          <div><p className="login-stat-n serif">240+</p><p className="login-stat-l">Houses</p></div>
          <div><p className="login-stat-n serif">11</p><p className="login-stat-l">Countries</p></div>
          <div><p className="login-stat-n serif">99.99</p><p className="login-stat-l">Uptime · %</p></div>
        </div>
        <div className="login-hero">
          <p className="eyebrow">Service · Mise en place</p>
          <h1 className="serif">Run the room<br />like it&apos;s <em>your kitchen</em>.</h1>
          <p className="login-hero-sub">
            Cafyz is the operating system used by 240+ restaurants — front of house,
            the line, and the back office in one tempered ecosystem.
          </p>
        </div>
      </section>

      {/* ── Desktop right pane ────────────────────────────────────── */}
      <section className="login-right">
        <p className="eyebrow">Sign In · Concierge</p>
        <h2 className="serif login-title">Welcome back.</h2>
        <p className="login-sub">Enter your work email to continue.</p>

        <label className="login-field">
          <span>Work email</span>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setLocalErr(''); clearError(); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </label>
        <label className="login-field">
          <span>Passphrase</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••••••"
          />
        </label>

        {displayError && <p className="login-error">{displayError}</p>}

        <button
          type="button"
          className="login-submit"
          onClick={handleLogin}
          disabled={busy}
        >
          {busy ? 'Signing in…' : 'Enter Cafyz →'}
        </button>

        {/* ── Get Account link ─────────────────────────────────────── */}
        <div className="login-get-account-bar">
          <span>New to Cafyz?</span>
          <a href="/get-account" className="login-get-account-link">
            View plans &amp; request access →
          </a>
        </div>
      </section>

      {/* ── Mobile PIN pane ────────────────────────────────────────── */}
      <section className="login-mobile-only">
        <div className="login-mobile-head">
          <div className="login-logo">C</div>
          <p className="serif">Cafyz</p>
        </div>
        <p className="eyebrow">Service · Welcome</p>
        <h2 className="serif">Good evening, <em>team.</em></h2>
        <p className="login-pin-label">PIN · 4 digits</p>
        <div className="login-pin-dots">
          {[0,1,2,3].map(i => <div key={i} className={pin.length > i ? 'filled' : ''} />)}
        </div>
        {localErr && <p className="login-error" style={{ textAlign: 'center' }}>{localErr}</p>}
        <div className="login-numpad">
          {[1,2,3,4,5,6,7,8,9,null,0,'back'].map((k, i) => (
            <button
              key={i}
              type="button"
              className={k === null ? 'hidden' : ''}
              disabled={k === null || busy}
              onClick={() => handlePin(k === 'back' ? 'back' : k === null ? null : k as number)}
            >
              {k === 'back' ? '⌫' : k}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
