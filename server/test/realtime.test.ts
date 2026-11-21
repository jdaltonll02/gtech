import {createServer, type Server as HttpServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import jwt from 'jsonwebtoken';
import {io as createClient, type Socket as ClientSocket} from 'socket.io-client';
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {config} from '../src/config.js';
import {attachRealtime, emitToUser, type RealtimeEnvelope} from '../src/modules/realtime/gateway.js';

const redis = {
  set: vi.fn(() => Promise.resolve('OK')),
  del: vi.fn(() => Promise.resolve(1)),
  exists: vi.fn(() => Promise.resolve(1)),
};

vi.mock('../src/core/redis.js', () => ({
  getRedis: vi.fn(() => Promise.resolve(redis)),
}));

const userId = '01900000-0000-7000-8000-000000000001';
const token = jwt.sign({sub: userId, type: 'access'}, config.JWT_SECRET, {expiresIn: '5m'});
const sendMessage = vi.fn((_authenticatedUserId: string, data: unknown) => Promise.resolve({accepted: true, data}));
const readMessage = vi.fn(() => Promise.resolve({read: true}));
const typing = vi.fn(() => Promise.resolve({relayed: true}));

let httpServer: HttpServer;
let realtimeServer: ReturnType<typeof attachRealtime>;
let baseUrl: string;
const clients: ClientSocket[] = [];

const connect = (accessToken?: string) => {
  const client = createClient(baseUrl, {
    path: '/ws/',
    transports: ['websocket'],
    reconnection: false,
    ...(accessToken ? {auth: {token: accessToken}} : {}),
  });
  clients.push(client);
  return client;
};

const waitForConnect = (client: ClientSocket) => new Promise<void>((resolve, reject) => {
  client.once('connect', resolve);
  client.once('connect_error', reject);
});

const emitWithAck = <T>(client: ClientSocket, event: string, data: unknown) =>
  new Promise<T>((resolve) => client.emit(event, data, resolve));

describe('realtime gateway', () => {
  beforeAll(async () => {
    httpServer = createServer();
    realtimeServer = attachRealtime(httpServer, {sendMessage, readMessage, typing});
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.close();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await realtimeServer.close();
    if (httpServer.listening) await new Promise<void>((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
  });

  it('rejects a socket without an access token', async () => {
    const client = connect();
    const error = await new Promise<Error>((resolve) => client.once('connect_error', resolve));
    expect(error.message).toBe('AUTHENTICATION_REQUIRED');
    expect(client.connected).toBe(false);
  });

  it('dispatches an authenticated message event and acknowledges it', async () => {
    const client = connect(token);
    await waitForConnect(client);
    const payload = {match_id: '01900000-0000-7000-8000-000000000002', body: 'Hello'};
    const acknowledgement = await emitWithAck<RealtimeEnvelope<{accepted: boolean}>>(client, 'message.send', payload);

    expect(sendMessage).toHaveBeenCalledWith(userId, payload);
    expect(acknowledgement.type).toBe('message.send.ack');
    expect(acknowledgement.data.accepted).toBe(true);
  });

  it('returns a structured error for an unsupported event', async () => {
    const client = connect(token);
    await waitForConnect(client);
    const response = await emitWithAck<RealtimeEnvelope<{code: string}>>(client, 'event', {type: 'account.delete', data: {}});

    expect(response.type).toBe('error');
    expect(response.data.code).toBe('EVENT_NOT_SUPPORTED');
  });

  it('refreshes presence and emits a pong envelope', async () => {
    const client = connect(token);
    await waitForConnect(client);
    const response = await emitWithAck<RealtimeEnvelope<Record<string, never>>>(client, 'ping', {});

    expect(redis.set).toHaveBeenCalledWith(`presence:${userId}`, expect.any(String), {EX: 60});
    expect(response.type).toBe('pong');
  });

  it('delivers server events to the authenticated user room', async () => {
    const client = connect(token);
    await waitForConnect(client);
    const received = new Promise<RealtimeEnvelope<{match_id: string}>>(resolve => client.once('event', resolve));
    emitToUser(userId, 'match.created', {match_id: '01900000-0000-7000-8000-000000000003'});

    const event = await received;
    expect(event.type).toBe('match.created');
    expect(event.data.match_id).toBe('01900000-0000-7000-8000-000000000003');
  });

  it('throttles events after the per-minute limit', async () => {
    const client = connect(token);
    await waitForConnect(client);
    for (let index = 0; index < 60; index += 1) {
      const response = await emitWithAck<RealtimeEnvelope<unknown>>(client, 'typing', {index});
      expect(response.type).toBe('typing.ack');
    }
    const limited = await emitWithAck<RealtimeEnvelope<{code: string}>>(client, 'typing', {index: 60});

    expect(limited.type).toBe('error');
    expect(limited.data.code).toBe('RATE_LIMITED');
    expect(typing).toHaveBeenCalledTimes(60);
  });
});
