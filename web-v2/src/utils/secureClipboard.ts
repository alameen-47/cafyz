/**
 * Copy sensitive text on explicit user gesture; warn user to verify paste target.
 * Does not read the clipboard (avoids participating in clipboard-snooping patterns).
 */
export async function secureCopyToClipboard(text: string): Promise<boolean> {
  const value = String(text ?? '').trim();
  if (!value || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/** Optional: clear clipboard after delay (reduces window for hijacking extensions). */
export function scheduleClipboardClear(delayMs = 60_000): void {
  if (!navigator.clipboard?.writeText) return;
  window.setTimeout(() => {
    void navigator.clipboard.writeText('').catch(() => { /* ignore */ });
  }, delayMs);
}
