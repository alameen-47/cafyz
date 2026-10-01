/**
 * Keep the previous value when a poll returns data identical to what is already
 * on screen.
 *
 * Live screens refetch every few seconds. Each response was mapped into fresh
 * arrays and objects, so React saw a new identity every time and re-rendered
 * the whole list — on a quiet service that is hundreds of pointless renders an
 * hour, each one churning the DOM (and waking the translation pass with it).
 * Returning the previous reference lets React bail out of the update entirely.
 *
 * Used as `setRows((prev) => keepIfSame(prev, next))`.
 */
export function keepIfSame<T>(prev: T, next: T): T {
  return deepEqual(prev, next) ? prev : next;
}

/**
 * Structural comparison for API payloads: primitives, arrays and plain objects.
 * Anything exotic (Date, Map, class instance) falls back to reference equality,
 * which is the safe answer — an unequal verdict only costs a re-render.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const aArray = Array.isArray(a);
  if (aArray !== Array.isArray(b)) return false;

  if (aArray) {
    const x = a as unknown[];
    const y = b as unknown[];
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (!deepEqual(x[i], y[i])) return false;
    return true;
  }

  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) {
    return false;
  }

  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  if (keys.length !== Object.keys(y).length) return false;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(y, k)) return false;
    if (!deepEqual(x[k], y[k])) return false;
  }
  return true;
}
