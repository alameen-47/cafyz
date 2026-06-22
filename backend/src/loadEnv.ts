/**
 * Load env vars from backend/.env regardless of process cwd (repo root vs backend/).
 * Root `.env` may only contain Vite vars — backend secrets live in backend/.env.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'backend/.env'),
  resolve(backendRoot, '.env'),
];

for (const envPath of candidates) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: true });
  }
}
