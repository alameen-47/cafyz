import { useEffect, useState } from 'react';
import { toastBus, type ToastMessage } from '../services/toastBus';
import './ToastViewport.css';

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toastBus.subscribe((msg) => {
      setToasts((prev) => [...prev, msg]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, msg.durationMs ?? 3200);
    });
  }, []);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function iconForTone(tone: ToastMessage['tone']) {
    if (tone === 'success') return '✓';
    if (tone === 'error') return '!';
    return 'i';
  }

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-msg toast-${toast.tone}`}>
          <span className="toast-icon" aria-hidden>{iconForTone(toast.tone)}</span>
          <div className="toast-body">
            <p className="toast-title">
              {toast.tone === 'success' ? 'Success' : toast.tone === 'error' ? 'Attention' : 'Info'}
            </p>
            <p className="toast-text">{toast.text}</p>
          </div>
          <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
