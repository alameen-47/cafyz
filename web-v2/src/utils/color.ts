/**
 * A colour at a given opacity, for colours kept in maps (role, plan, status, KPI colours).
 *
 * Hex colours get an alpha byte appended, as these call sites always did. Theme tokens such as
 * `var(--cafyz-brand)` cannot take an appended byte, so tokens that publish an `-rgb` triplet
 * (see theme-modes.css) become `rgba(var(--token-rgb), a)`, which works in every web view the
 * app supports; any other token falls back to color-mix.
 *
 * @param alphaByte opacity as the hex byte the old call sites appended (0x18 ≈ 9%).
 */
const RGB_TOKENS = new Set(["--cafyz-brand", "--cafyz-brand-2", "--cafyz-brand-deep", "--cafyz-brand-bright", "--cafyz-brand-alt"]);

export function withAlpha(color: string, alphaByte: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color + alphaByte.toString(16).padStart(2, "0");
  const alpha = Math.round((alphaByte / 255) * 1000) / 1000;
  const token = /^var\((--[\w-]+)\)$/.exec(color.trim())?.[1];
  if (token && RGB_TOKENS.has(token)) return `rgba(var(${token}-rgb), ${alpha})`;
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}
