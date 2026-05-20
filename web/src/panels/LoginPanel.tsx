import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEMO_ACCOUNTS, ROLE_LABELS, ROLE_DEFAULT_PATH, type Role } from '../context/AuthContext';
import './LoginPanel.css';

const ROLE_COLORS: Record<Role, string> = {
  manager: '#8b5cf6',
  cashier: '#2ecc8a',
  waiter:  '#60a5fa',
  kitchen: '#f0a500',
};

export function LoginPanel() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('mireille@saint.paris');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState<number[]>([]);
  const [error, setError] = useState('');

  function handleLogin() {
    const account = DEMO_ACCOUNTS.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!account) {
      setError('No account found for this email.');
      return;
    }
    setError('');
    login(account);
    navigate(ROLE_DEFAULT_PATH[account.role]);
  }

  function quickLogin(role: Role) {
    const account = DEMO_ACCOUNTS.find(a => a.role === role)!;
    login(account);
    navigate(ROLE_DEFAULT_PATH[role]);
  }

  const handlePin = (key: number | 'back' | null) => {
    if (key === null) return;
    if (key === 'back') { setPin(p => p.slice(0, -1)); return; }
    if (pin.length < 4) {
      const next = [...pin, key];
      setPin(next);
      if (next.length === 4) {
        const account = DEMO_ACCOUNTS.find(a => a.pin === next.join(''));
        if (account) {
          setTimeout(() => { login(account); navigate(ROLE_DEFAULT_PATH[account.role]); }, 300);
        } else {
          setTimeout(() => setPin([]), 400);
        }
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
          <div><p className="login-stat-n serif">240+</p><p className="login-stat-l">Houses</p></div>
          <div><p className="login-stat-n serif">11</p><p className="login-stat-l">Countries</p></div>
          <div><p className="login-stat-n serif">99.99</p><p className="login-stat-l">Uptime · %</p></div>
        </div>
        <div className="login-hero">
          <p className="eyebrow">Service · Mise en place</p>
          <h1 className="serif">Run the room<br />like it&apos;s <em>your kitchen</em>.</h1>
          <p className="login-hero-sub">
            Cafyz is the operating system used by 240+ restaurants — front of house, the line, and the back office in one tempered ecosystem.
          </p>
        </div>
      </section>

      <section className="login-right">
        <p className="eyebrow">Sign In · Concierge</p>
        <h2 className="serif login-title">Welcome back.</h2>
        <p className="login-sub">Enter your work email to continue.</p>

        <label className="login-field">
          <span>Work email</span>
          <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
        </label>
        <label className="login-field">
          <span>Passphrase</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••••••" />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="button" className="login-submit" onClick={handleLogin}>
          Enter Cafyz →
        </button>

        <div className="login-divider"><span /><p>Or sign in as</p><span /></div>

        <div className="login-roles">
          {DEMO_ACCOUNTS.map(a => (
            <button
              key={a.id}
              type="button"
              className="login-role-btn"
              style={{ '--rc': ROLE_COLORS[a.role] } as React.CSSProperties}
              onClick={() => quickLogin(a.role)}
            >
              <span className="login-role-init serif">{a.initials}</span>
              <span>
                <span className="login-role-name">{a.name}</span>
                <span className="login-role-label">{ROLE_LABELS[a.role]}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="login-quick">
          <p className="eyebrow">Quick access · panels</p>
          <div className="login-quick-btns">
            <button type="button" onClick={() => quickLogin('cashier')}>Cashier / POS</button>
            <button type="button" onClick={() => quickLogin('kitchen')}>Kitchen</button>
            <button type="button" onClick={() => quickLogin('waiter')}>Tables</button>
            <button type="button" onClick={() => { const a = DEMO_ACCOUNTS.find(x => x.role === 'waiter')!; login(a); navigate('/mobile/orders'); }}>Waiter mobile</button>
          </div>
        </div>
      </section>

      <section className="login-mobile-only">
        <div className="login-mobile-head">
          <div className="login-logo">C</div>
          <p className="serif">Cafyz</p>
        </div>
        <p className="eyebrow">Service · Welcome</p>
        <h2 className="serif">Good evening, <em>Jules.</em></h2>
        <p className="login-pin-label">PIN · 4 digits</p>
        <div className="login-pin-dots">
          {[0,1,2,3].map(i => <div key={i} className={pin.length > i ? 'filled' : ''} />)}
        </div>
        <div className="login-numpad">
          {[1,2,3,4,5,6,7,8,9,null,0,'back'].map((k,i) => (
            <button
              key={i}
              type="button"
              className={k === null ? 'hidden' : ''}
              disabled={k === null}
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
