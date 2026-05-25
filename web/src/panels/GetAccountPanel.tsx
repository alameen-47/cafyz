import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import './GetAccountPanel.css';

type PlanKey = 'basic' | 'pro' | 'premium';

interface PlanDef {
  key:        PlanKey;
  label:      string;
  price:      string;
  billing:    string;
  badge?:     string;
  color:      string;
  icon:       string;
  tagline:    string;
  features:   string[];
  locked:     string[];
}

const PLANS: PlanDef[] = [
  {
    key:     'basic',
    label:   'Basic',
    price:   '$49',
    billing: 'per month',
    color:   '#60a5fa',
    icon:    '◯',
    tagline: 'Everything you need to run a single location.',
    features: [
      'Point of Sale (POS)',
      'Menu management',
      'Floor plan & tables',
      'Mobile waiter app',
      'Order tracking',
      'Up to 5 staff accounts',
    ],
    locked: [
      'Kitchen Display (KDS)',
      'Manager dashboard',
      'Inventory management',
      'Reservations',
      'Advanced analytics',
    ],
  },
  {
    key:     'pro',
    label:   'Pro',
    price:   '$99',
    billing: 'per month',
    badge:   'Most Popular',
    color:   '#8b5cf6',
    icon:    '✦',
    tagline: 'The full hospitality stack for serious operators.',
    features: [
      'Everything in Basic',
      'Kitchen Display System (KDS)',
      'Manager dashboard & analytics',
      'Inventory & par management',
      'Staff roles & scheduling',
      'Daily P&L reports',
      'Up to 25 staff accounts',
    ],
    locked: [
      'Reservations management',
      'Multi-location support',
      'Priority support',
    ],
  },
  {
    key:     'premium',
    label:   'Premium',
    price:   '$199',
    billing: 'per month',
    color:   '#f0a500',
    icon:    '★',
    tagline: 'Multi-location power with white-glove support.',
    features: [
      'Everything in Pro',
      'Reservations & cover management',
      'Multi-location & branching',
      'Unlimited staff accounts',
      'Priority onboarding',
      'Dedicated account manager',
      'API access',
    ],
    locked: [],
  },
];

const BASE = (import.meta as any).env?.VITE_API_URL ?? '';

export function GetAccountPanel() {
  const { theme, toggleTheme } = useTheme();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('pro');
  const [form, setForm] = useState({ name: '', restaurant_name: '', email: '', message: '' });
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }));
      setError('');
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())            { setError('Please enter your name.');           return; }
    if (!form.restaurant_name.trim()) { setError('Please enter your restaurant name.'); return; }
    if (!form.email.trim())           { setError('Please enter your email address.');   return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.'); return;
    }

    setBusy(true); setError('');
    try {
      const res = await fetch(`${BASE}/api/inquiries`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...form, plan: selectedPlan }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Something went wrong. Please try again.');
      }
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ga-root">
      <button className="ga-theme-toggle theme-toggle" onClick={toggleTheme} title="Toggle theme">
        {theme === 'dark' ? '☀︎' : '◗'}
      </button>

      {/* ── Left brand panel ─────────────────────────────────────── */}
      <aside className="ga-left">
        <a href="/login" className="ga-back">← Back to Sign In</a>

        <div className="ga-brand">
          <div className="ga-logo">C</div>
          <div>
            <p className="serif ga-brand-name">Cafyz</p>
            <p className="mono ga-brand-sub">HOSPITALITY OS</p>
          </div>
        </div>

        <div className="ga-hero">
          <p className="eyebrow">Plans · Pricing</p>
          <h1 className="serif">The OS that runs<br />the <em>world's best</em><br />restaurants.</h1>
          <p className="ga-hero-sub">
            From a single-table wine bar in Lyon to a 12-location group in Tokyo — Cafyz powers front of house, the line, and the back office in one tempered system.
          </p>
        </div>

        <div className="ga-trust-grid">
          <div className="ga-trust-item">
            <span className="serif ga-trust-n">240+</span>
            <span className="ga-trust-l">Restaurants</span>
          </div>
          <div className="ga-trust-item">
            <span className="serif ga-trust-n">11</span>
            <span className="ga-trust-l">Countries</span>
          </div>
          <div className="ga-trust-item">
            <span className="serif ga-trust-n">99.99%</span>
            <span className="ga-trust-l">Uptime</span>
          </div>
          <div className="ga-trust-item">
            <span className="serif ga-trust-n">★★</span>
            <span className="ga-trust-l">Michelin partners</span>
          </div>
        </div>

        <div className="ga-quote">
          <p className="serif ga-quote-text">"We recovered a full hour of dinner service in the first month."</p>
          <div className="ga-quote-author">
            <div className="ga-quote-av">HL</div>
            <div>
              <p className="ga-quote-name">Henri Lecomte</p>
              <p className="ga-quote-role">Chef de cuisine · Saint, Paris ★★</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right content ─────────────────────────────────────────── */}
      <main className="ga-right">
        {success ? (
          <SuccessView name={form.name} email={form.email} plan={selectedPlan} />
        ) : (
          <>
            <p className="eyebrow">Get Started · Choose Your Plan</p>
            <h2 className="serif ga-right-title">New to Cafyz?</h2>
            <p className="ga-right-sub">
              Choose a plan, tell us about your restaurant, and our founder will personally set up your account within 24 hours.
            </p>

            {/* ── Plan cards ─────────────────────────────────────── */}
            <div className="ga-plans">
              {PLANS.map(plan => (
                <PlanCard
                  key={plan.key}
                  plan={plan}
                  selected={selectedPlan === plan.key}
                  onSelect={() => setSelectedPlan(plan.key)}
                />
              ))}
            </div>

            {/* ── Inquiry form ───────────────────────────────────── */}
            <div className="ga-form-wrap">
              <div className="ga-form-header">
                <div className="ga-form-eyebrow">
                  <span className="eyebrow">Inquiry · {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan</span>
                  <button
                    type="button"
                    className="ga-plan-chip"
                    style={{ '--pc': PLANS.find(p => p.key === selectedPlan)?.color } as React.CSSProperties}
                  >
                    {PLANS.find(p => p.key === selectedPlan)?.icon}&nbsp;&nbsp;{PLANS.find(p => p.key === selectedPlan)?.label} · {PLANS.find(p => p.key === selectedPlan)?.price}/mo
                  </button>
                </div>
                <p className="ga-form-sub">Fill in your details and we'll have your credentials ready within 24 hours.</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="ga-field-row">
                  <label className="ga-field">
                    <span>Your Name</span>
                    <input
                      type="text"
                      placeholder="Henri Lecomte"
                      value={form.name}
                      onChange={set('name')}
                      autoComplete="name"
                    />
                  </label>
                  <label className="ga-field">
                    <span>Restaurant Name</span>
                    <input
                      type="text"
                      placeholder="Saint, Paris"
                      value={form.restaurant_name}
                      onChange={set('restaurant_name')}
                    />
                  </label>
                </div>

                <label className="ga-field">
                  <span>Work Email</span>
                  <input
                    type="email"
                    placeholder="you@restaurant.com"
                    value={form.email}
                    onChange={set('email')}
                    autoComplete="email"
                  />
                </label>

                <label className="ga-field">
                  <span>Message <span className="ga-optional">(optional)</span></span>
                  <textarea
                    placeholder="Tell us about your restaurant — seats, covers per service, any special requirements…"
                    value={form.message}
                    onChange={set('message')}
                    rows={3}
                  />
                </label>

                {error && <p className="ga-error">{error}</p>}

                <button type="submit" className="ga-submit" disabled={busy}>
                  {busy ? (
                    <span className="ga-submit-inner">
                      <span className="ga-spinner" />
                      Sending your request…
                    </span>
                  ) : (
                    <span className="ga-submit-inner">
                      Request Access · {PLANS.find(p => p.key === selectedPlan)?.label}
                      <span className="ga-submit-arrow">→</span>
                    </span>
                  )}
                </button>
              </form>

              <div className="ga-trust-note">
                <span>🔒</span>
                <span>Your credentials will be created personally by the Cafyz founder — no automated signups. Access is granted only after plan confirmation.</span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function PlanCard({ plan, selected, onSelect }: { plan: PlanDef; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`ga-plan-card ${selected ? 'selected' : ''} ${plan.badge ? 'featured' : ''}`}
      style={{ '--plan-color': plan.color } as React.CSSProperties}
      onClick={onSelect}
    >
      {plan.badge && <div className="ga-plan-badge">{plan.badge}</div>}
      <div className="ga-plan-top">
        <div className="ga-plan-icon serif">{plan.icon}</div>
        <div>
          <div className="ga-plan-name serif">{plan.label}</div>
          <div className="ga-plan-price">
            <span className="serif ga-plan-amount">{plan.price}</span>
            <span className="ga-plan-billing">{plan.billing}</span>
          </div>
        </div>
      </div>
      <p className="ga-plan-tagline">{plan.tagline}</p>
      <ul className="ga-plan-features">
        {plan.features.map(f => (
          <li key={f} className="ga-feat-yes">
            <span className="ga-feat-check">✓</span>
            {f}
          </li>
        ))}
        {plan.locked.map(f => (
          <li key={f} className="ga-feat-no">
            <span className="ga-feat-lock">–</span>
            {f}
          </li>
        ))}
      </ul>
      <div className={`ga-plan-select-ring ${selected ? 'active' : ''}`}>
        {selected && <span className="ga-plan-select-dot" />}
      </div>
    </button>
  );
}

function SuccessView({ name, email, plan }: { name: string; email: string; plan: PlanKey }) {
  const planDef = PLANS.find(p => p.key === plan)!;
  const firstName = name.split(' ')[0];

  return (
    <div className="ga-success">
      <div className="ga-success-icon">✓</div>
      <p className="eyebrow">Request Received · {planDef.label} Plan</p>
      <h2 className="serif ga-success-title">
        You're on the list,<br /><em style={{ color: planDef.color }}>{firstName}.</em>
      </h2>
      <p className="ga-success-sub">
        Your <strong>{planDef.label} plan</strong> request has been sent. Check <strong>{email}</strong> — we've sent a confirmation with full details.
      </p>

      <div className="ga-success-steps">
        <div className="ga-step">
          <div className="ga-step-num" style={{ '--sc': planDef.color } as React.CSSProperties}>1</div>
          <div className="ga-step-body">
            <p className="ga-step-title">Founder reviews your request</p>
            <p className="ga-step-desc">Our founder personally sets up every new account to ensure quality onboarding.</p>
          </div>
        </div>
        <div className="ga-step">
          <div className="ga-step-num" style={{ '--sc': planDef.color } as React.CSSProperties}>2</div>
          <div className="ga-step-body">
            <p className="ga-step-title">You receive your license key & credentials</p>
            <p className="ga-step-desc">A unique license key and login details will be sent to {email} within 24 hours.</p>
          </div>
        </div>
        <div className="ga-step">
          <div className="ga-step-num" style={{ '--sc': planDef.color } as React.CSSProperties}>3</div>
          <div className="ga-step-body">
            <p className="ga-step-title">Sign in & go live</p>
            <p className="ga-step-desc">Log in at the Cafyz Sign In page with your credentials and enter your license key to activate your plan.</p>
          </div>
        </div>
      </div>

      <div className="ga-success-auto-reply">
        <div className="ga-auto-header">
          <span className="ga-auto-from">📬 Auto-reply sent to {email}</span>
        </div>
        <div className="ga-auto-preview">
          <p className="ga-auto-subject serif">We received your request, {firstName}. ✓</p>
          <p className="ga-auto-body">
            Thank you for your interest in Cafyz. Your request for the <strong>{planDef.label} Plan</strong> has been received and forwarded to our founder. A representative will be in touch within 24 hours with your license key and login credentials.
          </p>
          <p className="ga-auto-sig">— The Cafyz Team</p>
        </div>
      </div>

      <a href="/login" className="ga-back-login">← Return to Sign In</a>
    </div>
  );
}
