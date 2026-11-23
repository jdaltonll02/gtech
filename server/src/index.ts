import {createServer} from 'node:http';
import {createApp} from './app.js';
import {config} from './config.js';
import {runMigrations} from './db/migrationsRunner.js';
import {readMessages,relayTyping,sendMessage} from './modules/chat/services.js';
import {attachRealtime} from './modules/realtime/gateway.js';

const start = async () => {
  await runMigrations();
  const server = createServer(createApp());
  attachRealtime(server,{sendMessage,readMessage:readMessages,typing:relayTyping});
  server.listen(config.PORT, () => console.info(`Pepper API listening on :${config.PORT}`));
};

void start().catch((error: unknown) => {
  console.error('Pepper startup failed', error);
  process.exitCode = 1;
});
