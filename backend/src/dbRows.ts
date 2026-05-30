import type { InArgs, Row } from '@libsql/client';

/** Read a column from a libSQL row (strict TS safe). */
export function rowString(row: Row | undefined, key: string): string {
  if (!row) return '';
  const v = row[key as keyof Row];
  return v == null ? '' : String(v);
}

export function rowNumber(row: Row | undefined, key: string): number {
  return Number(rowString(row, key));
}

/** Express :id route param → string for SQL args. */
export function paramId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return String(value ?? '');
}

export type { InArgs };
