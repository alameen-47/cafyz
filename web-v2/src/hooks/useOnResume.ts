import { useEffect } from 'react';

/**
 * Runs `refresh` when the app comes back on screen or the internet returns. Phones block a
 * locked or backgrounded app's network, so requests made then fail; this reloads the page's
 * data the moment staff open the app again instead of waiting for the next poll.
 */
export function onResume(refresh: () => void): () => void {
  let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : 0;
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    // Skip quick app switches; anything longer may have missed updates or failed to load.
    if (hiddenAt && Date.now() - hiddenAt > 3000) refresh();
    hiddenAt = 0;
  };
  const onOnline = () => refresh();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('online', onOnline);
  };
}

export function useOnResume(refresh: () => void, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onResume(refresh), deps);
}
