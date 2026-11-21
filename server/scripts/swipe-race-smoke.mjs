import jwt from 'jsonwebtoken';

const [userA,userB]=process.argv.slice(2);
if(!userA||!userB)throw new Error('Usage: node scripts/swipe-race-smoke.mjs <user-a> <user-b>');
const secret=process.env.JWT_SECRET??'unsafe-local-development-key-change-in-production';
const token=(id)=>jwt.sign({sub:id,type:'access'},secret,{expiresIn:'5m'});
const swipe=(from,to)=>fetch('http://localhost:8000/api/v1/swipes',{method:'POST',headers:{authorization:`Bearer ${token(from)}`,'content-type':'application/json'},body:JSON.stringify({target_id:to,action:'like',client_ts:new Date().toISOString()})}).then(async(response)=>({status:response.status,body:await response.json()}));
const results=await Promise.all([swipe(userA,userB),swipe(userB,userA)]);
if(results.some((result)=>result.status!==201)||!results.some((result)=>result.body.matched===true))throw new Error(JSON.stringify(results));
const repeated=await swipe(userA,userB);
const matchesResponse=await fetch('http://localhost:8000/api/v1/matches',{headers:{authorization:`Bearer ${token(userA)}`}});
const matches=await matchesResponse.json();
if(!repeated.body.idempotent||!repeated.body.matched||matches.results?.length!==1)throw new Error(JSON.stringify({repeated,matches}));
console.log(JSON.stringify({concurrent:results,idempotent:repeated.body,matches:matches.results.length},null,2));
