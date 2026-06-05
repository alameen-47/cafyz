export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  text: string;
  tone: ToastTone;
  durationMs?: number;
}

type Listener = (msg: ToastMessage) => void;

const listeners = new Set<Listener>();

function emit(msg: ToastMessage) {
  for (const listener of listeners) listener(msg);
}

function push(tone: ToastTone, text: string, durationMs = 3200) {
  emit({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tone,
    text,
    durationMs,
  });
}

export const toastBus = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  success(text: string, durationMs?: number) {
    push('success', text, durationMs ?? 2600);
  },
  error(text: string, durationMs?: number) {
    push('error', text, durationMs ?? 4200);
  },
  info(text: string, durationMs?: number) {
    push('info', text, durationMs ?? 3000);
  },
};
