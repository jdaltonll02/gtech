import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {activateBoost,getEntitlements,getPurchase,handlePaymentWebhook,initiateMobileMoney,listProducts,verifyPurchase} from './services.js';

const writeLimit=rateLimit({windowMs:60_000,limit:10});
export const billingRouter=Router();
billingRouter.get('/billing/products',async(_request,response)=>response.json({results:await listProducts()}));
billingRouter.get('/billing/entitlements',authenticate,async(request,response)=>response.json(await getEntitlements(authenticatedUserId(request))));
billingRouter.post('/billing/verify',authenticate,writeLimit,async(request,response)=>{const body=z.object({provider:z.enum(['fake','apple','google']),product_sku:z.string().min(1).max(100),receipt:z.string().min(1).max(100_000),currency:z.enum(['USD','LRD']).default('USD')}).strict().parse(request.body);response.status(201).json(await verifyPurchase(authenticatedUserId(request),{provider:body.provider,productSku:body.product_sku,receipt:body.receipt,currency:body.currency}));});
billingRouter.post('/billing/mobile-money/initiate',authenticate,writeLimit,async(request,response)=>{const body=z.object({provider:z.enum(['orange_money','mtn_momo']),sku:z.string().min(1).max(100),msisdn:z.string().regex(/^\+[1-9]\d{7,14}$/),currency:z.enum(['USD','LRD']).default('LRD')}).strict().parse(request.body);response.status(201).json(await initiateMobileMoney(authenticatedUserId(request),body));});
billingRouter.get('/billing/purchases/:id',authenticate,async(request,response)=>response.json(await getPurchase(authenticatedUserId(request),z.uuid().parse(request.params.id))));
billingRouter.post('/billing/boost/activate',authenticate,writeLimit,async(request,response)=>response.json(await activateBoost(authenticatedUserId(request))));
billingRouter.post('/billing/webhooks/:provider',rateLimit({windowMs:60_000,limit:120}),async(request,response)=>{const provider=z.enum(['orange_money','mtn_momo','fake']).parse(request.params.provider);const body=z.object({event_id:z.string().min(1),provider_ref:z.string().min(1),status:z.enum(['succeeded','failed','refunded']),expires_at:z.iso.datetime().optional(),auto_renew:z.boolean().optional()}).passthrough().parse(request.body);response.json(await handlePaymentWebhook(provider,request.header('x-pepper-signature'),{event_id:body.event_id,provider_ref:body.provider_ref,status:body.status,...(body.expires_at?{expires_at:body.expires_at}:{}),...(body.auto_renew===undefined?{}:{auto_renew:body.auto_renew})}));});
