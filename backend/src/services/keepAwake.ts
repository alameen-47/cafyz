/**
 * Keeps a Render free instance from spinning down.
 *
 * Render stops a free web service after 15 minutes with no inbound traffic, and
 * the next caller then waits around 50 seconds while it boots — long enough for
 * an App Reviewer to decide the app is broken. A request the service makes to
 * its own public URL comes back in through Render's router as inbound traffic,
 * so it resets that timer.
 *
 * Off unless KEEP_AWAKE is set, and deliberately so: a service that never sleeps
 * burns about 730 of the 750 free instance hours a Render account gets per
 * calendar month, and running out suspends every free service in the account
 * until the 1st. With more than one free service, leave this on only where a
 * cold start actually costs something, or narrow it with KEEP_AWAKE_WINDOW.
 *
 *   KEEP_AWAKE=true           turn it on
 *   KEEP_AWAKE_WINDOW=3-20    only ping between 03:00 and 20:59 UTC (optional)
 */
const PING_INTERVAL_MS = Number(process.env.KEEP_AWAKE_INTERVAL_MS ?? 10 * 60 * 1000);

function parseWindow(raw: string | undefined): { from: number; to: number } | null {
  if (!raw) return null;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(raw.trim());
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (from > 23 || to > 23) return null;
  return { from, to };
}

/** True when the current UTC hour is inside the window, or there is no window. */
function withinWindow(w: { from: number; to: number } | null, hour: number): boolean {
  if (!w) return true;
  // A window that wraps midnight, e.g. 22-6.
  return w.from <= w.to ? hour >= w.from && hour <= w.to : hour >= w.from || hour <= w.to;
}

export function startKeepAwake(): void {
  if (process.env.KEEP_AWAKE !== 'true') return;

  // Render sets this to the service's own https URL. Without it we would be
  // pinging localhost, which never reaches the router and so changes nothing.
  const base = process.env.RENDER_EXTERNAL_URL;
  if (!base) {
    console.warn('[KeepAwake] RENDER_EXTERNAL_URL is not set — skipping (a localhost ping would not keep the instance up)');
    return;
  }

  const url = `${base.replace(/\/$/, '')}/health`;
  const window = parseWindow(process.env.KEEP_AWAKE_WINDOW);
  if (process.env.KEEP_AWAKE_WINDOW && !window) {
    console.warn(`[KeepAwake] Ignoring malformed KEEP_AWAKE_WINDOW "${process.env.KEEP_AWAKE_WINDOW}" — expected e.g. 3-20`);
  }

  const tick = async () => {
    if (!withinWindow(window, new Date().getUTCHours())) return;
    try {
      await fetch(url, { method: 'GET' });
    } catch (err) {
      // A failed ping is not worth crashing or spamming the log over; the next
      // one is ten minutes away.
      console.warn('[KeepAwake] Ping failed:', (err as Error).message);
    }
  };

  // unref so this timer never holds the process open during a shutdown.
  setInterval(tick, PING_INTERVAL_MS).unref();
  console.log(
    `[KeepAwake] Pinging ${url} every ${Math.round(PING_INTERVAL_MS / 60000)} min` +
    (window ? ` between ${window.from}:00 and ${window.to}:59 UTC` : ' (always)')
  );
}
