import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {createApp} from '../src/app.js';
import {openApi} from '../src/core/openapi.js';

describe('operations API', () => {
  it('reports process health', async () => {
    const response = await request(createApp()).get('/api/v1/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({status: 'ok'});
  });

  it.each([
    ['patch','/api/v1/profiles/me'],['put','/api/v1/profiles/me/location'],['post','/api/v1/media/photos/upload-url'],['post','/api/v1/auth/devices'],['get','/api/v1/sync?since=2026-11-16T00:00:00.000Z'],['post','/api/v1/chat/upload-url'],['get','/api/v1/notifications/preferences'],['get','/api/v1/billing/entitlements'],['post','/api/v1/billing/verify'],['post','/api/v1/billing/mobile-money/initiate'],['post','/api/v1/billing/boost/activate'],['get','/api/v1/discovery/top-picks'],['post','/api/v1/safety/blocks'],['post','/api/v1/safety/reports'],['post','/api/v1/safety/verification/start'],['get','/api/v1/admin/moderation/queue'],['post','/api/v1/account/pause'],['post','/api/v1/account/resume'],['get','/api/v1/account/export'],['delete','/api/v1/account'],
  ] as const)('requires authentication for %s %s',async(method,path)=>{
    const response=await request(createApp())[method](path).send({});
    expect(response.status).toBe(401);
    const body=response.body as {error:{code:string}};
    expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('returns the documented OpenAPI document',async()=>{
    const response=await request(createApp()).get('/api/v1/schema');
    expect(response.status).toBe(200);
    const body=response.body as {openapi:string;paths:Record<string,unknown>};
    expect(body.openapi).toBe('3.1.0');
    expect(Object.keys(body.paths)).toEqual(expect.arrayContaining(Object.keys(openApi.paths)));
    expect(body.paths).toHaveProperty('/api/v1/schema.get');
    expect(body.paths).toHaveProperty('/api/v1/auth/devices/{id}.delete');
  });
});
