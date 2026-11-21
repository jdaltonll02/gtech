import jwt from 'jsonwebtoken';
import request from 'supertest';
import {describe,expect,it} from 'vitest';
import {createApp} from '../src/app.js';
import {config} from '../src/config.js';
import {providers,verifyWebhookSignature} from '../src/modules/billing/providers.js';
import type {ProductRow} from '../src/modules/billing/repositories.js';

const product:ProductRow={id:'019a9000-0000-7000-8000-000000000001',sku:'pepper_gold_month',kind:'subscription',tier:'gold',consumable:null,duration_days:30,quantity:0,price_usd:'12.99',price_lrd:'2470.00',store_product_id_ios:'pepper_gold_month',store_product_id_android:'pepper_gold_month',active:true};

describe('billing',()=>{
  it('verifies fake receipts deterministically outside production',async()=>{const first=await providers.fake.verify('receipt-1',product);const second=await providers.fake.verify('receipt-1',product);expect(first.providerRef).toBe(second.providerRef);expect(first.expiresAt?.getTime()).toBeGreaterThan(Date.now());});
  it('rejects an empty fake receipt',async()=>{await expect(providers.fake.verify('',product)).rejects.toMatchObject({code:'INVALID_RECEIPT'});});
  it('requires authentication and validates purchase payloads',async()=>{const app=createApp();await request(app).get('/api/v1/billing/entitlements').expect(401);const access=jwt.sign({sub:'019a9000-0000-7000-8000-000000000002',type:'access'},config.JWT_SECRET,{expiresIn:'5m'});const response=await request(app).post('/api/v1/billing/verify').set('authorization',`Bearer ${access}`).send({provider:'fake',product_sku:'pepper_gold_month'});expect(response.status).toBe(400);expect(response.body).toHaveProperty('error.code','VALIDATION_ERROR');});
  it('rejects Apple and Google events on the generic webhook contract',async()=>{expect(verifyWebhookSignature('apple',undefined,{})).toBe(false);expect(verifyWebhookSignature('google','anything',{})).toBe(false);const app=createApp();for(const provider of['apple','google']){const response=await request(app).post(`/api/v1/billing/webhooks/${provider}`).send({event_id:'event-1',provider_ref:'purchase-1',status:'succeeded'});expect(response.status).toBe(400);expect(response.body).toHaveProperty('error.code','VALIDATION_ERROR');}});
});
