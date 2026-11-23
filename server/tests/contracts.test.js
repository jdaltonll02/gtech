import { beforeAll,describe,expect,it,vi } from 'vitest';
import request from 'supertest';

process.env.SECRET_KEY='test-secret-key-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL='postgresql://test:test@localhost:5432/test';
process.env.ENVIRONMENT='test';
process.env.RATE_LIMIT_PER_MINUTE='1000';
process.env.MOMO_CALLBACK_SECRET='expected-secret';

const db=vi.hoisted(()=>({$queryRaw:vi.fn(),$queryRawUnsafe:vi.fn(),$executeRaw:vi.fn(),$executeRawUnsafe:vi.fn(),$transaction:vi.fn()}));
vi.mock('../src/lib/prisma.js',()=>({prisma:db,disconnectPrisma:vi.fn()}));
vi.mock('../src/services/payments.js',()=>({capturePayPalOrder:vi.fn(),createPayPalOrder:vi.fn(),createStripeIntent:vi.fn(),retrieveStripeIntent:vi.fn(),getMomoStatus:vi.fn(),requestMomoPayment:vi.fn(),verifyStripeWebhook:vi.fn(()=>{throw Object.assign(new Error('Webhook error: invalid signature'),{status:400});})}));

let makeApp;
beforeAll(async()=>{({createApp:makeApp}=await import('../src/app.js'));});

describe('ported API contracts',()=>{
 it('rejects weak registration data with FastAPI-style 422 details',async()=>{const r=await request(makeApp()).post('/api/v1/auth/register').send({email:'user@example.com',full_name:'Test User',password:'weak'}).expect(422);expect(Array.isArray(r.body.detail)).toBe(true);expect(r.body.detail[0]).toHaveProperty('loc');});
 it('requires bearer authentication for /auth/me',async()=>{const r=await request(makeApp()).get('/api/v1/auth/me').expect(403);expect(r.body).toEqual({detail:'Not authenticated'});});
 it('rejects a MoMo callback with the wrong shared secret',async()=>{const r=await request(makeApp()).post('/api/v1/payments/momo/callback?secret=wrong').send({externalId:'ref'}).expect(403);expect(r.body).toEqual({detail:'Invalid callback secret'});});
 it('rejects an invalid Stripe webhook signature',async()=>{const r=await request(makeApp()).post('/api/v1/payments/stripe/webhook').set('stripe-signature','bad').set('content-type','application/json').send('{"type":"payment_intent.succeeded"}').expect(400);expect(r.body.detail).toContain('invalid signature');});
});
