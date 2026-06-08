export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  text: string;
  tone: ToastTone;
  durationMs?: number;
}

type Listener = (msg: ToastMessage) => void;

const listeners = new Set<Listener>();
const recentToastTimes = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5000;

function emit(msg: ToastMessage) {
  for (const listener of listeners) listener(msg);
}

function push(tone: ToastTone, text: string, durationMs = 3200) {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const key = `${tone}:${normalized.toLowerCase()}`;
  const now = Date.now();
  const last = recentToastTimes.get(key) ?? 0;
  if (now - last < DEDUPE_WINDOW_MS) return;
  recentToastTimes.set(key, now);

  emit({
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    tone,
    text: normalized,
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
