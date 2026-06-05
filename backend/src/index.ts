import dns from 'node:dns';
import 'dotenv/config';
import app from './app.js';

// Render and other cloud hosts often lack working IPv6 routes to Gmail.
dns.setDefaultResultOrder('ipv4first');
import { runMigrations } from './schema.js';
import { ensureFounderAccount } from './services/ensureFounder.js';
import { startTrialReminderScheduler } from './services/trialReminderScheduler.js';

const PORT = Number(process.env.PORT ?? 4000);

async function start() {
  await runMigrations();
  console.log('✓ Migrations complete');
  await ensureFounderAccount();
  startTrialReminderScheduler();

  const server = app.listen(PORT, () => {
    console.log(`🍽  Cafyz API running on http://localhost:${PORT}`);
  });

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
