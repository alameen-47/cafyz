/**
 * Load env vars from backend/.env regardless of process cwd (repo root vs backend/).
 * Root `.env` may only contain Vite vars — backend secrets live in backend/.env.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// TURSO_URL=:memory: set before startup (dev preview, tests) asks for a throwaway database.
// The .env files load with override: true and may point at the live database, so keep it.
const forceMemoryDb = process.env.TURSO_URL === ':memory:';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend/.env'),
  resolve(backendRoot, '.env'),
];

// Tests configure their own env (vitest.config.ts) and must never pick up live
// secrets — the database, email, payment and SMS keys in a developer's .env.
if (process.env.NODE_ENV !== 'test') {
  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      config({ path: envPath, override: true });
    }
  }
}

if (forceMemoryDb) {
  process.env.TURSO_URL = ':memory:';
  delete process.env.TURSO_AUTH_TOKEN;
}
