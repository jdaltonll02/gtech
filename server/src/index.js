import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config, warnForMissingIntegrations } from './config.js';
import { closeKv, ensureKvTable } from './lib/kv.js';
import { ensureEnumCasts } from './lib/enum-casts.js';
import { disconnectPrisma } from './lib/prisma.js';
import { runSqlMigrations } from './lib/migrations.js';
import { startScheduler } from './jobs/scheduler.js';
import { startDurableWorker } from './jobs/durable.js';
import { durableJobHandlers } from './jobs/handlers.js';

warnForMissingIntegrations();

// No top-level await in this file: Hostinger's LiteSpeed launcher (lsnode.js) loads the entry
// with require(), which Node refuses for ES modules that use top-level await
// (ERR_REQUIRE_ASYNC_MODULE). Schema setup therefore runs in the background after listen().
async function ensureDatabaseSetup() {
  try {
    await runSqlMigrations();
  } catch (error) {
    console.error('Could not apply SQL migrations; features requiring the latest schema may be unavailable', error.message);
  }
  try {
    await ensureKvTable();
  } catch (error) {
    // Keep serving: public pages work without it; auth features log their own errors.
    console.error('Could not ensure kv_store table; logins and password resets will fail until it exists', error.message);
  }
  try {
    await ensureEnumCasts();
  } catch (error) {
    console.error('Could not check enum casts', error.message);
  }
  return startDurableWorker(durableJobHandlers);
}

const server = createServer(createApp());
const scheduler=startScheduler();
let durableWorker=null;

server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`${config.APP_NAME} ${config.APP_VERSION} listening on 0.0.0.0:${config.PORT}`);
});
ensureDatabaseSetup().then((worker)=>{durableWorker=worker;});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  scheduler.stop();
  durableWorker?.stop();
  server.close(async () => {
    await Promise.allSettled([closeKv(), disconnectPrisma()]);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
