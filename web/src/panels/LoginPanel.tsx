import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pathForScreen } from '../routes';
import './LoginPanel.css';

export function LoginPanel() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('mireille@saint.paris');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState<number[]>([]);

  const handlePin = (key: number | 'back' | null) => {
    if (key === null) return;
    if (key === 'back') {
      setPin(p => p.slice(0, -1));
      return;
    }
    if (pin.length < 4) {
      const next = [...pin, key];
      setPin(next);
      if (next.length === 4) {
        setTimeout(() => navigate(pathForScreen('mobileOrders')), 300);
      }
    }
  };

  return (
    <div className="login-root">
      <section className="login-left">
        <div className="login-brand">
          <div className="login-logo">C</div>
          <div>
            <p className="serif login-brand-name">Cafyz</p>
            <p className="mono login-brand-sub">HOSPITALITY OS</p>
          </div>
        </div>
        <div className="login-stats">
          <div>
            <p className="login-stat-n serif">240+</p>
            <p className="login-stat-l">Houses</p>
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
          <p className="eyebrow">Service · Mise en place</p>
          <h1 className="serif">
            Run the room
            <br />
            like it&apos;s <em>your kitchen</em>.
          </h1>
          <p className="login-hero-sub">
            Cafyz is the operating system used by 240+ restaurants — front of house,
            the line, and the back office in one tempered ecosystem.
          </p>
        </div>
      </section>

      <section className="login-right">
        <p className="eyebrow">Sign In · Concierge</p>
        <h2 className="serif login-title">Welcome back, Mireille.</h2>
        <p className="login-sub">
          Doors open at 18:30. Two reservations await your approval.
        </p>

        <label className="login-field">
          <span>Work email</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>
        <label className="login-field">
          <span>Passphrase</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••••"
          />
        </label>

        <button
          type="button"
          className="login-submit"
          onClick={() => navigate(pathForScreen('manager'))}
        >
          Enter Cafyz →
        </button>

        <div className="login-divider">
          <span />
          <p>Or</p>
          <span />
        </div>

        <div className="login-alt">
          <button type="button" className="btn-outline">
            SSO · Workspace
          </button>
          <button type="button" className="btn-outline">
            Pair Device
          </button>
        </div>

        <div className="login-quick">
          <p className="eyebrow">Quick access · panels</p>
          <div className="login-quick-btns">
            <button type="button" onClick={() => navigate(pathForScreen('pos'))}>
              Cashier / POS
            </button>
            <button type="button" onClick={() => navigate(pathForScreen('kds'))}>
              Kitchen
            </button>
            <button type="button" onClick={() => navigate(pathForScreen('waiter'))}>
              Tables
            </button>
            <button type="button" onClick={() => navigate(pathForScreen('mobileOrders'))}>
              Waiter mobile
            </button>
          </div>
        </div>
      </section>

      <section className="login-mobile-only">
        <div className="login-mobile-head">
          <div className="login-logo">C</div>
          <p className="serif">Cafyz</p>
        </div>
        <p className="eyebrow">Service · Welcome</p>
        <h2 className="serif">
          Good evening, <em>Jules.</em>
        </h2>
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
              disabled={k === null}
              onClick={() =>
                handlePin(k === 'back' ? 'back' : k === null ? null : k)
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
