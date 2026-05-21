import 'dotenv/config';
import app from './app.js';
import { runMigrations } from './schema.js';

const PORT = Number(process.env.PORT ?? 4000);

async function start() {
  await runMigrations();
  console.log('✓ Migrations complete');

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
