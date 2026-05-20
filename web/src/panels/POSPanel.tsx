import { useState } from 'react';
import { CATEGORIES, DISHES, INITIAL_ORDER, type OrderItem } from '../data/menu';
import './POSPanel.css';

type PaymentMethod = 'open' | 'card' | 'cash' | 'sent';

export function POSPanel() {
  const [cat, setCat] = useState('mains');
  const [order, setOrder] = useState<OrderItem[]>(INITIAL_ORDER);
  const [tableNote, setTableNote] = useState<string | null>(null);
  const [compApplied, setCompApplied] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('open');

  const visible = DISHES.filter(d => cat === 'all' || d.cat === cat);
  const orderMap = Object.fromEntries(order.map(o => [o.id, o.qty]));

  const addDish = (id: number) => {
    setOrder(prev => {
      const i = prev.findIndex(o => o.id === id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { id, qty: 1, mods: [] }];
    });
  };

  const changeQty = (id: number, delta: number) => {
    setOrder(prev =>
      prev
        .map(o => (o.id === id ? { ...o, qty: o.qty + delta } : o))
        .filter(o => o.qty > 0),
    );
  };

  const subtotal = order.reduce(
    (s, o) => s + (DISHES.find(d => d.id === o.id)?.price ?? 0) * o.qty,
    0,
  );
  const billable = compApplied ? 0 : subtotal;
  const service = billable * 0.18;
  const tax = billable * 0.0875;
  const total = billable + service + tax;

  const statusLabel =
    paymentMethod === 'card'
      ? 'Paid · Card'
      : paymentMethod === 'cash'
        ? 'Paid · Cash'
        : paymentMethod === 'sent'
          ? 'Sent'
          : compApplied
            ? 'Comped'
            : splitMode
              ? 'Split'
              : 'Open';

  const statusClass =
    paymentMethod !== 'open' || compApplied ? 'badge-paid' : 'badge-pending';

  return (
    <div className="pos-layout">
      <section className="pos-grid">
        <div className="pos-toolbar">
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={`pos-pill ${cat === c.id ? 'active' : ''}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
              <span className="mono">{c.count}</span>
            </button>
          ))}
          <div className="pos-search">
            <span>🔍</span>
            <input placeholder="Search the menu" />
            <kbd className="mono">⌘K</kbd>
          </div>
        </div>

        <div className="pos-dishes">
          {visible.map(d => (
            <button
              key={d.id}
              type="button"
              className={`pos-dish card ${orderMap[d.id] ? 'selected' : ''}`}
              onClick={() => addDish(d.id)}
            >
              <div className="pos-dish-plate">
                <span className="pos-dish-sym serif">{d.sym}</span>
                {'popular' in d && d.popular && <span className="pos-popular">★ Popular</span>}
                {orderMap[d.id] && (
                  <span className="pos-dish-qty mono">× {orderMap[d.id]}</span>
                )}
              </div>
              <div className="pos-dish-info">
                <p className="pos-dish-name">{d.name}</p>
                <p className="pos-dish-price mono">${d.price}</p>
                <p className="pos-dish-sub">{d.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <aside className="pos-order">
        <header className="pos-order-head">
          <div>
            <p className="eyebrow">Active Check</p>
            <h2 className="serif">Table 12 · Vasseur</h2>
            <p className="pos-meta">
              4 guests · Jules R. · <span className="mono">00:41</span>
            </p>
          </div>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
        </header>

        {tableNote && <p className="pos-note">Note · {tableNote}</p>}

        <ul className="pos-items">
          {order.map(o => {
            const d = DISHES.find(x => x.id === o.id);
            if (!d) return null;
            return (
              <li key={o.id} className="pos-item">
                <span className="pos-item-qty mono">{o.qty}</span>
                <div className="pos-item-body">
                  <div className="pos-item-row">
                    <span>{d.name}</span>
                    <span className="mono">${(d.price * o.qty).toFixed(2)}</span>
                  </div>
                  {o.mods.map(m => (
                    <p key={m} className="pos-mod">
                      · {m}
                    </p>
                  ))}
                  <div className="pos-qty-btns">
                    <button type="button" onClick={() => changeQty(o.id, -1)}>
                      −
                    </button>
                    <button type="button" onClick={() => changeQty(o.id, 1)}>
                      +
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="pos-extras">
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              setTableNote('Allergies: shellfish — anniversary dessert')
            }
          >
            {tableNote ? 'Edit note' : 'Add note'}
          </button>
          <button
            type="button"
            className={`btn-outline ${compApplied ? 'active' : ''}`}
            onClick={() => setCompApplied(true)}
            disabled={compApplied}
          >
            {compApplied ? 'Comped' : 'Comp'}
          </button>
          <button
            type="button"
            className={`btn-outline ${splitMode ? 'active' : ''}`}
            onClick={() => setSplitMode(true)}
          >
            {splitMode ? 'Split · 2' : 'Split'}
          </button>
        </div>

        <footer className="pos-totals">
          <div className="pos-total-row">
            <span>Subtotal</span>
            <span className="mono">${subtotal.toFixed(2)}</span>
          </div>
          <div className="pos-total-row">
            <span>Service · 18%</span>
            <span className="mono">${service.toFixed(2)}</span>
          </div>
          <div className="pos-total-row">
            <span>Tax · 8.75%</span>
            <span className="mono">${tax.toFixed(2)}</span>
          </div>
          <div className="pos-total-final">
            <span>Total Due</span>
            <span className="serif">${total.toFixed(2)}</span>
          </div>
          <button
            type="button"
            className={`pos-charge ${paymentMethod === 'card' ? 'done' : ''}`}
            disabled={paymentMethod !== 'open' || order.length === 0}
            onClick={() => setPaymentMethod('card')}
          >
            💳 {paymentMethod === 'card' ? 'Charged' : 'Charge'} · ${total.toFixed(2)}
          </button>
          <div className="pos-alt-pay">
            <button
              type="button"
              className={paymentMethod === 'cash' ? 'active' : ''}
              disabled={paymentMethod !== 'open'}
              onClick={() => setPaymentMethod('cash')}
            >
              💵 Cash
            </button>
            <button
              type="button"
              className={paymentMethod === 'sent' ? 'active' : ''}
              disabled={paymentMethod !== 'open'}
              onClick={() => setPaymentMethod('sent')}
            >
              🧾 Send
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
