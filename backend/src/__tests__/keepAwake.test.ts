import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL = { ...process.env };

async function loadFresh() {
  vi.resetModules();
  return (await import('../services/keepAwake.js')).startKeepAwake;
}

describe('startKeepAwake', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...ORIGINAL };
    delete process.env.KEEP_AWAKE;
    delete process.env.KEEP_AWAKE_WINDOW;
    delete process.env.RENDER_EXTERNAL_URL;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL };
  });

  it('does nothing unless KEEP_AWAKE is set', async () => {
    process.env.RENDER_EXTERNAL_URL = 'https://example.onrender.com';
    (await loadFresh())();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does nothing without RENDER_EXTERNAL_URL, since localhost would not reach the router', async () => {
    process.env.KEEP_AWAKE = 'true';
    (await loadFresh())();
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('pings its own /health often enough to beat the 15 minute spin-down', async () => {
    process.env.KEEP_AWAKE = 'true';
    process.env.RENDER_EXTERNAL_URL = 'https://example.onrender.com';
    (await loadFresh())();

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(fetch).toHaveBeenCalledWith('https://example.onrender.com/health', { method: 'GET' });

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(2);
  });

  it('stays quiet outside the configured window', async () => {
    vi.setSystemTime(new Date('2026-10-23T01:00:00Z'));
    process.env.KEEP_AWAKE = 'true';
    process.env.RENDER_EXTERNAL_URL = 'https://example.onrender.com';
    process.env.KEEP_AWAKE_WINDOW = '6-20';
    (await loadFresh())();

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('honours a window that wraps past midnight', async () => {
    vi.setSystemTime(new Date('2026-10-23T23:30:00Z'));
    process.env.KEEP_AWAKE = 'true';
    process.env.RENDER_EXTERNAL_URL = 'https://example.onrender.com';
    process.env.KEEP_AWAKE_WINDOW = '22-6';
    (await loadFresh())();

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('survives a failed ping', async () => {
    process.env.KEEP_AWAKE = 'true';
    process.env.RENDER_EXTERNAL_URL = 'https://example.onrender.com';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    (await loadFresh())();

    await expect(vi.advanceTimersByTimeAsync(20 * 60 * 1000)).resolves.not.toThrow();
    expect((fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(2);
  });
});
