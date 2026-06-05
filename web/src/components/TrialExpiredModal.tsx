import { createPortal } from 'react-dom';

interface Props {
  purchaseUrl?: string;
  expiresAt?: string | null;
}

export function TrialExpiredModal({ purchaseUrl = '/license', expiresAt }: Props) {
  const expiryLabel = expiresAt ? new Date(expiresAt).toLocaleString() : null;

  return createPortal(
    <div className="trial-lock-overlay" role="dialog" aria-modal="true" aria-labelledby="trial-lock-title">
      <div className="trial-lock-card">
        <p className="eyebrow">Subscription Required</p>
        <h2 id="trial-lock-title" className="serif trial-lock-title">Your 7-day Premium trial has ended</h2>
        <p className="trial-lock-text">
          Access is locked for manager and staff accounts until a subscription is purchased.
          {expiryLabel ? ` Trial ended on ${expiryLabel}.` : ''}
        </p>
        <a href={purchaseUrl} className="trial-lock-cta">Buy Subscription Now →</a>
      </div>
    </div>,
    document.body,
  );
}
