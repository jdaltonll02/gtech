import {createServer} from 'node:http';
import {createApp} from './app.js';
import {config} from './config.js';
import {readMessages,relayTyping,sendMessage} from './modules/chat/services.js';
import {attachRealtime} from './modules/realtime/gateway.js';

const server = createServer(createApp());
attachRealtime(server,{sendMessage,readMessage:readMessages,typing:relayTyping});
server.listen(config.PORT, () => console.info(`Pepper API listening on :${config.PORT}`));
