import { storageGet, storageSet } from './safeStorage';

const CODE_KEY = 'cafyz_currency_code';
const SYMBOL_KEY = 'cafyz_currency_symbol';

/** Display symbols for UI (screens, QR menu). */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'AED',
  SAR: 'SAR',
  INR: '₹',
  PKR: 'Rs',
  BDT: '৳',
  NGN: '₦',
  ZAR: 'R',
};

/** Thermal-printer-safe symbols — ESC/POS cannot print ₹, €, etc. */
export const CURRENCY_PRINT_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: 'EUR',
  GBP: 'GBP',
  AED: 'AED',
  SAR: 'SAR',
  INR: 'Rs.',
  PKR: 'Rs.',
  BDT: 'BDT',
  NGN: 'NGN',
  ZAR: 'R',
};

const UNICODE_TO_PRINT: Record<string, string> = {
  '₹': 'Rs.',
  '€': 'EUR',
  '£': 'GBP',
  '৳': 'BDT',
  '₦': 'NGN',
  Rs: 'Rs.',
  'Rs.': 'Rs.',
  INR: 'Rs.',
};

export function symbolForCode(code?: string | null): string {
  const safe = String(code ?? '').trim().toUpperCase();
  if (!safe) return CURRENCY_SYMBOLS.USD;
  return CURRENCY_SYMBOLS[safe] ?? safe;
}

export function symbolForCodePrint(code?: string | null): string {
  const safe = String(code ?? '').trim().toUpperCase();
  if (!safe) return CURRENCY_PRINT_SYMBOLS.USD;
  return CURRENCY_PRINT_SYMBOLS[safe] ?? safe;
}

/** True when a saved symbol no longer matches the currency code (e.g. "$" with INR). */
function isStaleSymbolForCode(code: string, sym: string): boolean {
  if (!sym) return true;
  if (sym === '$' && code !== 'USD') return true;
  return false;
}

/**
 * Resolve display symbol — currency code wins over stale overrides like "$" left on INR.
 */
export function resolveCurrencySymbol(code?: string | null, symbolOverride?: string | null): string {
  const safeCode = String(code ?? '').trim().toUpperCase();
  const custom = String(symbolOverride ?? '').trim();
  if (safeCode) {
    if (!custom || isStaleSymbolForCode(safeCode, custom)) return symbolForCode(safeCode);
    return custom;
  }
  if (custom) {
    const activeCode = getActiveCurrencyCode();
    if (!isStaleSymbolForCode(activeCode, custom)) return custom;
  }
  return symbolForCode(getActiveCurrencyCode());
}

/** @deprecated use setActiveCurrency */
export function setActiveCurrencyCode(code?: string | null): void {
  setActiveCurrency(code);
}

/** Persist restaurant currency for panels that load before /me finishes. */
export function setActiveCurrency(code?: string | null, symbol?: string | null): void {
  const safeCode = String(code ?? '').trim().toUpperCase();
  if (safeCode) storageSet(CODE_KEY, safeCode);
  const sym = safeCode
    ? resolveCurrencySymbol(safeCode, symbol)
    : String(symbol ?? '').trim() || (safeCode ? symbolForCode(safeCode) : '');
  if (sym) storageSet(SYMBOL_KEY, sym);
}

export function getActiveCurrencyCode(fallback = 'USD'): string {
  const raw = storageGet(CODE_KEY);
  if (!raw) return fallback;
  return String(raw).trim().toUpperCase() || fallback;
}

export function getActiveCurrencySymbol(): string {
  return resolveCurrencySymbol(getActiveCurrencyCode(), storageGet(SYMBOL_KEY));
}

/** Resolve symbol: explicit override → code map → active session default. */
export function getCurrencySymbol(code?: string | null, symbolOverride?: string | null): string {
  return resolveCurrencySymbol(code, symbolOverride);
}

export function applyRestaurantCurrency(r: {
  currency_code?: string | null;
  currency_symbol?: string | null;
}): void {
  const code = r.currency_code ?? getActiveCurrencyCode();
  const symbol = resolveCurrencySymbol(code, r.currency_symbol);
  setActiveCurrency(code, symbol);
}

export function formatMoney(
  amount: number,
  code?: string | null,
  symbolOverride?: string | null,
): string {
  const sym = code || symbolOverride
    ? getCurrencySymbol(code, symbolOverride)
    : getActiveCurrencySymbol();
  return `${sym}${Number(amount || 0).toFixed(2)}`;
}

/**
 * Currency prefix for thermal ESC/POS receipts.
 * Currency code wins over a stale "$" or "₹" so INR always prints as Rs.
 */
export function currencySymbolForPrint(symbol?: string | null, code?: string | null): string {
  const safeCode = String(code ?? getActiveCurrencyCode()).trim().toUpperCase();
  if (safeCode && CURRENCY_PRINT_SYMBOLS[safeCode]) {
    return CURRENCY_PRINT_SYMBOLS[safeCode];
  }

  const sym = String(symbol ?? '').trim();
  if (sym && UNICODE_TO_PRINT[sym]) return UNICODE_TO_PRINT[sym];

  if (sym && /^[\x20-\x7E]+$/.test(sym) && sym !== '$') return sym;

  if (safeCode) return safeCode;
  return CURRENCY_PRINT_SYMBOLS.USD;
}

export function formatMoneyForPrint(
  amount: number,
  symbol?: string | null,
  code?: string | null,
): string {
  const sym = currencySymbolForPrint(symbol, code);
  const gap = sym.endsWith('.') ? ' ' : '';
  return `${sym}${gap}${Number(amount || 0).toFixed(2)}`;
}
