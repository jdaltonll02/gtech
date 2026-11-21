import request from 'supertest';
import {describe,expect,it,vi} from 'vitest';
import {AppError} from '../src/core/errors.js';

const mocks=vi.hoisted(()=>({
  verifyApple:vi.fn(),
  verifyGoogle:vi.fn(),
  handle:vi.fn(),
}));

vi.mock('../src/modules/billing/storeNotifications.js',()=>({
  storeNotificationVerifiers:{
    apple:{verify:mocks.verifyApple},
    google:{verify:mocks.verifyGoogle},
  },
}));

vi.mock('../src/modules/billing/services.js',async()=>{
  const actual=await vi.importActual<typeof import('../src/modules/billing/services.js')>('../src/modules/billing/services.js');
  return{...actual,handleStoreNotification:mocks.handle};
});

import {createApp} from '../src/app.js';

const appleEvent={provider:'apple' as const,eventId:'apple-event',providerRef:'original-transaction',status:'succeeded' as const,grantProduct:true,payload:{}};
const googleEvent={provider:'google' as const,eventId:'google-event',providerRef:'purchase-token',status:'expired' as const,grantProduct:false,payload:{}};

describe('store notification endpoints',()=>{
  it('validates the Apple V2 envelope',async()=>{const response=await request(createApp()).post('/api/v1/billing/webhooks/apple').send({});expect(response.status).toBe(400);expect(response.body).toHaveProperty('error.code','VALIDATION_ERROR');});

  it('processes a verified Apple notification',async()=>{mocks.verifyApple.mockResolvedValueOnce(appleEvent);mocks.handle.mockResolvedValueOnce({idempotent:false});const response=await request(createApp()).post('/api/v1/billing/webhooks/apple').send({signedPayload:'signed-jws'});expect(response.status).toBe(200);expect(mocks.verifyApple).toHaveBeenCalledWith({signedPayload:'signed-jws'});expect(mocks.handle).toHaveBeenCalledWith(appleEvent);expect(response.body).toEqual({idempotent:false});});

  it('requires a valid Google Pub/Sub identity',async()=>{mocks.verifyGoogle.mockRejectedValueOnce(new AppError(401,'INVALID_STORE_NOTIFICATION','Invalid notification.'));const body={message:{messageId:'message-1',data:'e30='}};const response=await request(createApp()).post('/api/v1/billing/webhooks/google').send(body);expect(response.status).toBe(401);expect(response.body).toHaveProperty('error.code','INVALID_STORE_NOTIFICATION');});

  it('processes an authenticated Google notification',async()=>{mocks.verifyGoogle.mockResolvedValueOnce(googleEvent);mocks.handle.mockResolvedValueOnce({idempotent:true});const body={message:{messageId:'message-1',data:'e30='}};const response=await request(createApp()).post('/api/v1/billing/webhooks/google').set('authorization','Bearer signed-google-token').send(body);expect(response.status).toBe(200);expect(mocks.verifyGoogle).toHaveBeenCalledWith(body,'Bearer signed-google-token');expect(mocks.handle).toHaveBeenCalledWith(googleEvent);expect(response.body).toEqual({idempotent:true});});
});
