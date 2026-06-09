/**
 * Lightweight process-local TTL cache.
 *
 * Eliminates repeated DB round trips for middleware guards (subscription,
 * section-access, plan) that read the same rows on every request. Each entry
 * expires after its configured TTL and is pruned lazily on read or by the
 * periodic cleanup interval.
 *
 * NOT suitable for multi-process deployments without an external store.
 * For Render's single-instance free tier this is the right trade-off.
 */

interface Entry {
  value: unknown;
  expires: number;
}

const store = new Map<string, Entry>();

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheDel(key: string): void {
  store.delete(key);
}

/** Invalidate all keys that start with a given prefix. */
export function cacheDelPrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

// Prune expired entries every 2 minutes to keep memory bounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expires) store.delete(k);
  }
}, 120_000).unref();
