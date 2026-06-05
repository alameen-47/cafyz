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

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-msg toast-${toast.tone}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
