import {randomUUID} from 'node:crypto';

const baseUrl=process.env.API_BASE_URL??'http://localhost:8000/api/v1';

const request=async(path,options={})=>{
  const response=await fetch(`${baseUrl}${path}`,{
    ...options,
    headers:{'content-type':'application/json',...(options.token?{authorization:`Bearer ${options.token}`}:{})},
    body:options.body===undefined?undefined:JSON.stringify(options.body),
  });
  const payload=response.status===204?null:await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`${options.method??'GET'} ${path} failed (${response.status}): ${JSON.stringify(payload)}`);
  return payload;
};

const challenge=await request('/auth/otp/request',{method:'POST',body:{phone:'+231770000001'}});
const session=await request('/auth/otp/verify',{method:'POST',body:{challenge_id:challenge.challenge_id,code:'000000'}});
const token=session.access;

const [profile,preferences,deckResponse,likes,productsResponse]=await Promise.all([
  request('/profiles/me',{token}),
  request('/profiles/me/preferences',{token}),
  request('/discovery/deck?limit=20',{token}),
  request('/likes/received',{token}),
  request('/billing/products',{token}),
]);
if(!profile.display_name||!preferences.max_distance_km)throw new Error('Profile or discovery preferences are incomplete.');

let matches=(await request('/matches?limit=50',{token})).results;
if(!matches.length){
  for(const card of deckResponse.results){
    const swipe=await request('/swipes',{method:'POST',token,body:{target_id:card.id,action:'like',client_ts:new Date().toISOString()}});
    if(swipe.matched)break;
  }
  matches=(await request('/matches?limit=50',{token})).results;
}
if(!matches.length)throw new Error('No match was available or created for chat verification.');

let messageVerified=false;
const match=matches[0];
const body=`Local E2E ${new Date().toISOString()}`;
const sent=await request(`/matches/${match.id}/messages`,{method:'POST',token,body:{client_id:randomUUID(),kind:'text',body}});
const history=(await request(`/matches/${match.id}/messages?limit=50`,{token})).results;
messageVerified=sent.body===body&&history.some(message=>message.id===sent.id);
if(!messageVerified)throw new Error('The sent message was not present in chat history.');

const products=productsResponse.results;
const product=products.find(item=>item.tier==='gold'&&item.duration_days===30)??products.find(item=>item.kind==='subscription');
let purchaseVerified=false;
if(product){
  const purchase=await request('/billing/verify',{method:'POST',token,body:{provider:'fake',product_sku:product.sku,receipt:'pepper-local-product-flow-smoke-v1',currency:'USD'}});
  purchaseVerified=Boolean(purchase.purchase_id&&purchase.entitlements?.tier);
  if(!purchaseVerified)throw new Error('The development purchase did not return entitlements.');
}

console.info(JSON.stringify({
  authenticated:true,
  profile:profile.display_name,
  discovery_preferences:true,
  deck_count:deckResponse.results.length,
  likes_count:likes.count,
  matches_count:matches.length,
  message_verified:messageVerified,
  products_count:products.length,
  purchase_verified:purchaseVerified,
},null,2));
