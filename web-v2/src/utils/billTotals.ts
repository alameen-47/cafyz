/** Shared bill math for POS, receipts, and print tests. */

export interface BillTotalsInput {
  subtotal: number;
  serviceRatePct?: number | null;
  taxRatePct?: number | null;
  taxIncluded?: boolean | number | null;
}

export interface BillTotals {
  subtotal: number;
  serviceRate: number;
  taxRate: number;
  service: number;
  tax: number;
  grandTotal: number;
  taxIncluded: boolean;
}

export function isTaxIncluded(value: boolean | number | null | undefined): boolean {
  return value === true || value === 1;
}

export function computeBillTotals(input: BillTotalsInput): BillTotals {
  const subtotal = Number(input.subtotal) || 0;
  const serviceRate = Math.max(0, Number(input.serviceRatePct ?? 0));
  const taxRate = Math.max(0, Number(input.taxRatePct ?? 0));
  const taxIncluded = isTaxIncluded(input.taxIncluded ?? false);
  const service = subtotal * (serviceRate / 100);
  const taxableAmount = subtotal + service;
  const tax = taxIncluded && taxRate > 0
    ? taxableAmount - taxableAmount / (1 + taxRate / 100)
    : taxableAmount * (taxRate / 100);
  const grandTotal = taxIncluded ? taxableAmount : taxableAmount + tax;
  return { subtotal, serviceRate, taxRate, service, tax, grandTotal, taxIncluded };
}
