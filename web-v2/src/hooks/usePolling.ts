import { useEffect, useRef } from 'react';

/**
 * Run `fn` on an interval, but only while the app is actually on screen.
 *
 * The screens used to keep their timers running and check `visibilityState`
 * inside the callback, so a backgrounded tab still woke the main thread every
 * few seconds to decide to do nothing — on a tablet left on the pass all day,
 * that is a steady battery drain for no benefit. Stopping the timer while
 * hidden removes the wake-ups entirely; screens that need fresh data the moment
 * they come back already handle that through `onResume`.
 *
 * `fn` is kept in a ref so a new closure each render does not restart the timer.
 */
export function usePolling(fn: () => void, intervalMs: number, enabled = true): void {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let id: number | undefined;

    const start = () => { if (id === undefined) id = window.setInterval(() => saved.current(), intervalMs); };
    const stop = () => { if (id !== undefined) { window.clearInterval(id); id = undefined; } };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}
