const KEY = 'cafyz_currency_code';

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

export function setActiveCurrencyCode(code?: string | null): void {
  const safe = String(code ?? '').trim().toUpperCase();
  if (!safe) return;
  localStorage.setItem(KEY, safe);
}

export function getActiveCurrencyCode(fallback = 'USD'): string {
  const raw = localStorage.getItem(KEY);
  if (!raw) return fallback;
  return String(raw).trim().toUpperCase() || fallback;
}

export function getCurrencySymbol(code?: string | null): string {
  const safe = String(code ?? '').trim().toUpperCase();
  if (!safe) return CURRENCY_SYMBOLS.USD;
  return CURRENCY_SYMBOLS[safe] ?? safe;
}

export function formatMoney(amount: number, code?: string | null): string {
  return `${getCurrencySymbol(code ?? getActiveCurrencyCode())}${Number(amount || 0).toFixed(2)}`;
}
