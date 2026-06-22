import { createClient, type Client } from '@libsql/client';
import './loadEnv.js';

let _client: Client | null = null;

export function getDb(): Client {
  if (!_client) {
    const url   = process.env.TURSO_URL       ?? ':memory:';
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _client = createClient(url === ':memory:' ? { url } : { url, authToken });
  }
  return _client;
}

/** For tests: replace the singleton with an in-memory client */
export function setDb(client: Client) { _client = client; }
export function resetDb()             { _client = null;   }
