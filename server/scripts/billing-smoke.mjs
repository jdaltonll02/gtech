import {createHash} from 'node:crypto';
import jwt from 'jsonwebtoken';

const [userId,mode]=process.argv.slice(2);
if(!userId)throw new Error('Usage: node scripts/billing-smoke.mjs <user-id> [check-free]');
const base='http://localhost:8000/api/v1';
const secret=process.env.JWT_SECRET??'unsafe-local-development-key-change-in-production';
const token=jwt.sign({sub:userId,type:'access'},secret,{expiresIn:'5m'});
const call=async(path,options={})=>{const response=await fetch(`${base}${path}`,{...options,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...options.headers}});const body=response.status===204?null:await response.json();if(!response.ok)throw new Error(`${response.status} ${JSON.stringify(body)}`);return body;};
const entitlements=()=>call('/billing/entitlements');
if(mode==='check-free'){
  const value=await entitlements();
  if(value.tier!=='free'||value.unlimitedLikes||value.rewind||value.passport)throw new Error(`Expected expired free tier: ${JSON.stringify(value)}`);
  console.log(JSON.stringify({expiry_downgrade:true,tier:value.tier},null,2));
  process.exit(0);
}
const before=await entitlements();
if(before.tier!=='free')throw new Error(`Expected free tier before purchase: ${JSON.stringify(before)}`);
const buy=async(product_sku,receipt)=>call('/billing/verify',{method:'POST',body:JSON.stringify({provider:'fake',product_sku,receipt,currency:'USD'})});
const receipt=`phase4-platinum-${Date.now()}`;
const paid=await buy('pepper_platinum_month',receipt);
if(paid.entitlements.tier!=='platinum'||!paid.entitlements.unlimitedLikes||!paid.entitlements.readReceipts||!paid.entitlements.priorityRanking||paid.entitlements.boostsBalance<1)throw new Error(`Paid gates missing: ${JSON.stringify(paid)}`);
const repeated=await buy('pepper_platinum_month',receipt);
if(!repeated.idempotent||repeated.purchase_id!==paid.purchase_id)throw new Error(`Purchase was not idempotent: ${JSON.stringify(repeated)}`);
const boost=await call('/billing/boost/activate',{method:'POST',body:'{}'});
if(!boost.active||new Date(boost.expires_at).valueOf()-new Date(boost.starts_at).valueOf()!==30*60_000)throw new Error(`Boost duration invalid: ${JSON.stringify(boost)}`);
const providerRef=`fake-${createHash('sha256').update(`pepper_platinum_month:${receipt}`).digest('hex')}`;
const event={event_id:`refund-${Date.now()}`,provider_ref:providerRef,status:'refunded'};
const refunded=await call('/billing/webhooks/fake',{method:'POST',body:JSON.stringify(event)});
const duplicate=await call('/billing/webhooks/fake',{method:'POST',body:JSON.stringify(event)});
if(refunded.idempotent||!duplicate.idempotent||(await entitlements()).tier!=='free')throw new Error('Refund or webhook idempotency failed.');
const expiring=await buy('pepper_plus_week',`phase4-expiry-${Date.now()}`);
if(expiring.entitlements.tier!=='plus')throw new Error(`Expected Plus before expiry: ${JSON.stringify(expiring)}`);
console.log(JSON.stringify({free_gate:true,fake_purchase:true,purchase_idempotent:true,boost_30_minutes:true,webhook_idempotent:true,refund_downgrade:true,expiry_purchase_id:expiring.purchase_id},null,2));
