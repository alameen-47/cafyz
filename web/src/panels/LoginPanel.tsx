import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../services/api';
import './LoginPanel.css';

// Post-login navigation uses a full-page reload instead of React Router navigate()
// to avoid a timing race where RequireAuth/RequireFounder reads stale user context
// before the setUser() state update has been flushed.
function goTo(path: string) {
  window.location.href = path;
}

export function LoginPanel() {
  const { login, loginWithPin, error, clearError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const params = new URLSearchParams(window.location.search);
  const initialMode =
    params.get('mode') === 'forgot'
      ? 'forgot'
      : params.get('mode') === 'reset'
      ? 'reset'
      : 'login';

  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [localMsg, setLocalMsg] = useState('');
  const [resetToken] = useState(params.get('token') ?? '');

  const displayError = localErr || error;

  function switchMode(next: 'login' | 'forgot' | 'reset') {
    setMode(next);
    setLocalErr('');
    setLocalMsg('');
    clearError();
  }

  async function handleLogin() {
    if (!email.trim()) {
      setLocalErr('Enter your work email.');
      return;
    }
    setBusy(true);
    setLocalErr('');
    clearError();
    try {
      await login(email, password);
      const stored = JSON.parse(localStorage.getItem('cafyz_user') ?? '{}') as {
        role?: string;
      };
      goTo(stored.role === 'founder' ? '/founder' : '/');
    } catch (e) {
      setLocalErr((e as Error).message ?? 'Login failed');
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setLocalErr('Enter your email to reset your password.');
      return;
    }
    setBusy(true);
    setLocalErr('');
    setLocalMsg('');
    clearError();
    try {
      const data = await authApi.forgotPassword(email);
      setLocalMsg(data.message);
    } catch (e) {
      setLocalErr((e as Error).message ?? 'Could not start password reset');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    if (!resetToken) {
      setLocalErr('Reset token is missing. Request a new reset link.');
      return;
    }
    if (password.length < 8) {
      setLocalErr('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    setLocalErr('');
    setLocalMsg('');
    clearError();
    try {
      const data = await authApi.resetPassword(resetToken, password);
      setLocalMsg(data.message);
      setPassword('');
      setConfirmPassword('');
      setMode('login');
      window.history.replaceState({}, '', '/login');
    } catch (e) {
      setLocalErr((e as Error).message ?? 'Could not reset password');
    } finally {
      setBusy(false);
    }
  }

  const handlePin = (key: number | 'back' | null) => {
    if (key === null || busy) return;
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
      loginWithPin(next.join(''))
        .then(() => goTo('/'))
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
        <p className="eyebrow">
          {mode === 'login'
            ? 'Sign In · Restaurant Management'
            : mode === 'forgot'
            ? 'Account Recovery'
            : 'Set New Password'}
        </p>
        <h2 className="serif login-title">
          {mode === 'login'
            ? 'Welcome back.'
            : mode === 'forgot'
            ? 'Forgot password?'
            : 'Reset password'}
        </h2>
        <p className="login-sub">
          {mode === 'login'
            ? 'Enter your work email to continue.'
            : mode === 'forgot'
            ? 'Enter your email and we will send a reset link.'
            : 'Choose a new password for your account.'}
        </p>

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
            onKeyDown={e =>
              e.key === 'Enter' &&
              (mode === 'login' ? handleLogin() : handleForgotPassword())
            }
            disabled={mode === 'reset'}
          />
        </label>
        <label className="login-field">
          <span>{mode === 'reset' ? 'New passphrase' : 'Passphrase'}</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e =>
              e.key === 'Enter' &&
              (mode === 'reset' ? handleResetPassword() : handleLogin())
            }
            placeholder="••••••••••••"
            disabled={mode === 'forgot'}
          />
        </label>
        {mode === 'reset' && (
          <label className="login-field">
            <span>Confirm passphrase</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
              placeholder="Repeat new passphrase"
            />
          </label>
        )}

        {displayError && <p className="login-error">{displayError}</p>}
        {localMsg && <p className="login-success-message">{localMsg}</p>}

        <button
          type="button"
          className="login-submit"
          onClick={
            mode === 'login'
              ? handleLogin
              : mode === 'forgot'
              ? handleForgotPassword
              : handleResetPassword
          }
          disabled={busy}
        >
          {busy
            ? mode === 'login'
              ? 'Signing in…'
              : mode === 'forgot'
              ? 'Sending link…'
              : 'Resetting…'
            : mode === 'login'
            ? 'Enter Cafyz →'
            : mode === 'forgot'
            ? 'Send reset link'
            : 'Save new password'}
        </button>

        <div className="login-secondary-links">
          {mode === 'login' && (
            <button
              type="button"
              className="login-link-btn"
              onClick={() => switchMode('forgot')}
            >
              Forgot password?
            </button>
          )}
          {mode !== 'login' && (
            <button
              type="button"
              className="login-link-btn"
              onClick={() => switchMode('login')}
            >
              Back to sign in
            </button>
          )}
        </div>

        {/* ── Get Account link ─────────────────────────────────────── */}
        <div className="login-get-account-bar">
          <span>New to Cafyz?</span>
          <a href="/get-account" className="login-get-account-link">
            View plans &amp; request access →
          </a>
        </div>
      </section>

      {/* ── Mobile PIN pane ────────────────────────────────────────── */}
      <section
        className="login-mobile-only"
        style={{ display: mode === 'login' ? undefined : 'none' }}
      >
        <div className="login-mobile-head">
          <div className="login-logo">C</div>
          <p className="serif">Cafyz</p>
        </div>
        <p className="eyebrow">Restaurant Operations · Welcome</p>
        <h2 className="serif">
          Good evening, <em>team.</em>
        </h2>
        <p className="login-pin-label">PIN · 4 digits</p>
        <div className="login-pin-dots">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={pin.length > i ? 'filled' : ''} />
          ))}
        </div>
        {localErr && (
          <p className="login-error" style={{ textAlign: 'center' }}>
            {localErr}
          </p>
        )}
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
      </section>
    </div>
  );
}
