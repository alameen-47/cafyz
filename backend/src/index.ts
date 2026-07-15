import dns from 'node:dns';
import './loadEnv.js';
import app from './app.js';

// Render and other cloud hosts often lack working IPv6 routes to Gmail.
dns.setDefaultResultOrder('ipv4first');
import { runMigrations } from './schema.js';
import { ensureFounderAccount } from './services/ensureFounder.js';
import { ensureStoreDemoAccount } from './services/ensureStoreDemo.js';
import { startTrialReminderScheduler } from './services/trialReminderScheduler.js';

const PORT = Number(process.env.PORT ?? 4000);

async function start() {
  await runMigrations();
  console.log('✓ Migrations complete');
  await ensureFounderAccount();
  await ensureStoreDemoAccount();
  startTrialReminderScheduler();

  const server = app.listen(PORT, () => {
    console.log(`🍽  Cafyz API running on http://localhost:${PORT}`);
  });
  // Slowloris / connection abuse hardening.
  server.requestTimeout = Number(process.env.SERVER_REQUEST_TIMEOUT_MS ?? 30_000);
  // keepAliveTimeout must exceed the load balancer's idle timeout (Render: ~60 s)
  // so the LB never tries to reuse a connection that Node has already closed.
  server.keepAliveTimeout = Number(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS ?? 75_000);
  // headersTimeout must be > keepAliveTimeout to prevent a race on pipelined requests.
  server.headersTimeout = Number(process.env.SERVER_HEADERS_TIMEOUT_MS ?? 80_000);
  server.maxRequestsPerSocket = Number(process.env.SERVER_MAX_REQUESTS_PER_SOCKET ?? 100);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

start().catch(err => { console.error(err); process.exit(1); });
