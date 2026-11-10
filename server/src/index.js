import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config, warnForMissingIntegrations } from './config.js';
import { closeKv } from './lib/kv.js';
import { disconnectPrisma } from './lib/prisma.js';
import { startScheduler } from './jobs/scheduler.js';

warnForMissingIntegrations();
const server = createServer(createApp());
const scheduler=startScheduler();

server.listen(config.PORT, '0.0.0.0', () => {
  console.log(`${config.APP_NAME} ${config.APP_VERSION} listening on 0.0.0.0:${config.PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  scheduler.stop();
  server.close(async () => {
    await Promise.allSettled([closeKv(), disconnectPrisma()]);
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
