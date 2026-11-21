import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Environment,SignedDataVerifier} from '@apple/app-store-server-library';
import {GoogleAuth} from 'google-auth-library';
import {config} from '../../config.js';
import {AppError} from '../../core/errors.js';
import type {ProductRow,Provider} from './repositories.js';

export type Verification={providerRef:string;originalTransactionId:string;expiresAt:Date|undefined;autoRenew:boolean;payload:unknown};
export interface PaymentProvider{verify(receipt:string,product:ProductRow):Promise<Verification>}
const invalid=()=>new AppError(400,'INVALID_RECEIPT','The store receipt could not be verified.');

const fakeProvider:PaymentProvider={verify:(receipt,product)=>{if(config.NODE_ENV==='production')return Promise.reject(new AppError(403,'PROVIDER_DISABLED','Fake payments are disabled in production.'));if(!receipt.trim())return Promise.reject(invalid());const ref=createHash('sha256').update(`${product.sku}:${receipt}`).digest('hex');return Promise.resolve({providerRef:`fake-${ref}`,originalTransactionId:`fake-${ref}`,expiresAt:product.duration_days?new Date(Date.now()+product.duration_days*86_400_000):undefined,autoRenew:false,payload:{development:true}});}};

const appleProvider:PaymentProvider={verify:async(receipt,product)=>{if(!config.APPLE_ROOT_CA_FILES||!config.APPLE_BUNDLE_ID)throw new AppError(503,'PROVIDER_NOT_CONFIGURED','Apple billing is not configured.');const roots=await Promise.all(config.APPLE_ROOT_CA_FILES.split(',').map(path=>readFile(path.trim())));const environment=config.APPLE_ENVIRONMENT==='production'?Environment.PRODUCTION:Environment.SANDBOX;const verifier=new SignedDataVerifier(roots,true,environment,config.APPLE_BUNDLE_ID,config.APPLE_APP_ID);const value=await verifier.verifyAndDecodeTransaction(receipt).catch(()=>{throw invalid();});if(value.productId!==product.store_product_id_ios||!value.transactionId||value.revocationDate)throw invalid();const originalTransactionId=value.originalTransactionId??value.transactionId;return{providerRef:originalTransactionId,originalTransactionId,expiresAt:value.expiresDate?new Date(value.expiresDate):undefined,autoRenew:false,payload:value};}};

const googleProvider:PaymentProvider={verify:async(receipt,product)=>{if(!config.GOOGLE_SERVICE_ACCOUNT_FILE||!config.GOOGLE_PACKAGE_NAME)throw new AppError(503,'PROVIDER_NOT_CONFIGURED','Google billing is not configured.');const auth=new GoogleAuth({keyFile:config.GOOGLE_SERVICE_ACCOUNT_FILE,scopes:['https://www.googleapis.com/auth/androidpublisher']});const client=await auth.getClient();const base=`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(config.GOOGLE_PACKAGE_NAME)}/purchases`;const url=product.kind==='subscription'?`${base}/subscriptionsv2/tokens/${encodeURIComponent(receipt)}`:`${base}/products/${encodeURIComponent(product.store_product_id_android)}/tokens/${encodeURIComponent(receipt)}`;const response=await client.request<Record<string,unknown>>({url}).catch(()=>{throw invalid();});const data=response.data;const rawState=data.subscriptionState??data.purchaseState;const state=typeof rawState==='string'||typeof rawState==='number'?String(rawState):'';if(product.kind==='subscription'&&!['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(state))throw invalid();if(product.kind==='consumable'&&state!=='0'&&state!=='PURCHASED')throw invalid();const items=Array.isArray(data.lineItems)?data.lineItems as Array<Record<string,unknown>>:[];const item=items[0];if(product.kind==='subscription'&&item?.productId!==product.store_product_id_android)throw invalid();const expiry=typeof item?.expiryTime==='string'?new Date(item.expiryTime):undefined;const rawOrder=data.latestOrderId??data.orderId;const orderId=typeof rawOrder==='string'?rawOrder:receipt;return{providerRef:receipt,originalTransactionId:orderId,expiresAt:expiry,autoRenew:Boolean((item?.autoRenewingPlan as Record<string,unknown>|undefined)?.autoRenewEnabled),payload:data};}};

export const providers:Record<'fake'|'apple'|'google',PaymentProvider>={fake:fakeProvider,apple:appleProvider,google:googleProvider};
export const mobileMoneyConfig=(provider:'orange_money'|'mtn_momo')=>provider==='orange_money'?{url:config.ORANGE_MONEY_API_URL,key:config.ORANGE_MONEY_API_KEY,secret:config.ORANGE_MONEY_WEBHOOK_SECRET}:{url:config.MTN_MOMO_API_URL,key:config.MTN_MOMO_API_KEY,secret:config.MTN_MOMO_WEBHOOK_SECRET};
export const verifyWebhookSignature=(provider:Provider,signature:string|undefined,body:unknown)=>{
  if(provider==='fake')return config.NODE_ENV!=='production';
  // Store notifications use provider-signed payloads, not Pepper's HMAC
  // contract. Keep them closed until a dedicated verifier normalizes them.
  if(provider==='apple'||provider==='google')return false;
  const secret=mobileMoneyConfig(provider).secret;
  if(!secret||!signature)return false;
  const expected=createHmac('sha256',secret).update(JSON.stringify(body)).digest('hex');
  const actual=Buffer.from(signature.replace(/^sha256=/,''));
  const wanted=Buffer.from(expected);
  return actual.length===wanted.length&&timingSafeEqual(actual,wanted);
};
