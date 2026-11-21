import {v7 as uuid7} from 'uuid';
import {AppError} from '../../core/errors.js';
import {getRedis} from '../../core/redis.js';
import {pool} from '../../db/pool.js';
import {swipeRepository,type MatchRow} from './repositories.js';
import {emitToUser,isUserOnline} from '../realtime/gateway.js';
import {sendPush} from '../notifications/services.js';
import {consumeWalletSuperlike,getEntitlements} from '../billing/services.js';

const limits={like:{limit:50,windowMs:12*60*60*1000},superlike:{limit:1,windowMs:24*60*60*1000}} as const;
const quotaKey=(userId:string,type:keyof typeof limits)=>`quota:${type}:${userId}`;
const quotaStatus=async(userId:string,type:keyof typeof limits,limit:number)=>{const redis=await getRedis();const key=quotaKey(userId,type);const used=Number(await redis.get(key)??0);const ttl=await redis.pTTL(key);return{left:Math.max(0,limit-used),resetsAt:new Date(Date.now()+(ttl>0?ttl:limits[type].windowMs)).toISOString()};};
const consumeQuota=async(userId:string,type:keyof typeof limits,limit:number)=>{const redis=await getRedis();const key=quotaKey(userId,type);const used=await redis.incr(key);if(used===1)await redis.pExpire(key,limits[type].windowMs);if(used>limit){await redis.decr(key);throw new AppError(429,'QUOTA_EXCEEDED',type==='like'?'You are out of likes for now.':'You are out of Super Likes for today.',{feature:type});}};
export const getQuotas=async(userId:string)=>{const entitlements=await getEntitlements(userId);const[likes,superlikes]=await Promise.all([quotaStatus(userId,'like',entitlements.unlimitedLikes?Number.MAX_SAFE_INTEGER:limits.like.limit),quotaStatus(userId,'superlike',entitlements.superlikesPerDay)]);return{likes_left:entitlements.unlimitedLikes?null:likes.left,superlikes_left:superlikes.left,superlikes_balance:entitlements.superlikesBalance,likes_reset_at:likes.resetsAt,superlikes_reset_at:superlikes.resetsAt};};
const matchDto=(match:MatchRow)=>({id:match.id,user_ids:[match.user_a_id,match.user_b_id],created_at:match.created_at});

export const createSwipe=async(userId:string,input:{targetId:string;action:'like'|'nope'|'superlike';clientTs?:string|undefined})=>{
  if(userId===input.targetId)throw new AppError(400,'VALIDATION_ERROR','You cannot swipe on yourself.');
  const client=await pool.connect();let quotaType:keyof typeof limits|undefined;let committed=false;
  try{
    const existing=await swipeRepository.findSwipe(client,userId,input.targetId);if(existing){const existingMatch=await swipeRepository.findActiveMatch(client,userId,input.targetId);return{matched:Boolean(existingMatch),...(existingMatch?{match:matchDto(existingMatch)}:{}),idempotent:true,quotas:await getQuotas(userId)};}
    if(!await swipeRepository.targetAvailable(client,userId,input.targetId))throw new AppError(404,'PROFILE_NOT_AVAILABLE','This profile is not available.');
    const entitlements=await getEntitlements(userId);quotaType=input.action==='like'&&!entitlements.unlimitedLikes?'like':input.action==='superlike'?'superlike':undefined;if(quotaType==='like')await consumeQuota(userId,'like',limits.like.limit);else if(quotaType==='superlike'){try{await consumeQuota(userId,'superlike',entitlements.superlikesPerDay);}catch(error){if(!(error instanceof AppError&&error.code==='QUOTA_EXCEEDED')||!await consumeWalletSuperlike(userId))throw error;quotaType=undefined;}}
    await client.query('BEGIN');
    await swipeRepository.lockPair(client,userId,input.targetId);
    const swipe=await swipeRepository.insertSwipe(client,{id:uuid7(),swiperId:userId,swipeeId:input.targetId,action:input.action,clientTs:input.clientTs});
    let match:MatchRow|undefined;
    if(swipe&&input.action!=='nope'&&await swipeRepository.hasReciprocalLike(client,userId,input.targetId)){const[userA,userB]=[userId,input.targetId].sort() as [string,string];match=await swipeRepository.createMatch(client,{id:uuid7(),userA,userB,initiatedBySuperlike:input.action==='superlike'});}
    await client.query('COMMIT');committed=true;
    if(!swipe&&quotaType){const redis=await getRedis();await redis.decr(quotaKey(userId,quotaType));quotaType=undefined;}
    const redis=await getRedis();await Promise.all([redis.sAdd(`swiped:${userId}`,input.targetId),redis.lRem(`deck:${userId}`,0,input.targetId),...(input.action==='nope'?[]:[redis.sAdd(`likes_in:${input.targetId}`,userId)])]).catch((error)=>console.warn('Swipe cache synchronization failed',error));
    if(match){const event=matchDto(match);emitToUser(match.user_a_id,'match.created',event);emitToUser(match.user_b_id,'match.created',event);for(const recipient of[match.user_a_id,match.user_b_id])if(!await isUserOnline(recipient))await sendPush({userId:recipient,kind:'new_matches',dedupKey:`match:${match.id}:${recipient}`,title:'You matched!',body:'Open Pepper and say hello.',data:{type:'match.created',match_id:match.id}}).catch((error)=>console.warn('Match push failed',error));}else if(swipe&&input.action!=='nope'){const count=await redis.sCard(`likes_in:${input.targetId}`);emitToUser(input.targetId,'like.received',{count});if(!await isUserOnline(input.targetId)&&[1,5,10,25,50].includes(count))await sendPush({userId:input.targetId,kind:'likes',dedupKey:`likes:${input.targetId}:${count}`,title:input.action==='superlike'?'Someone sent you a Super Like':'Someone likes you',body:`You have ${count} new ${count===1?'like':'likes'}.`,data:{type:'like.received',count:String(count)}}).catch((error)=>console.warn('Like push failed',error));}
    return{matched:Boolean(match),...(match?{match:matchDto(match)}:{}),idempotent:!swipe,quotas:await getQuotas(userId)};
  }catch(error){if(!committed){await client.query('ROLLBACK').catch(()=>undefined);if(quotaType&&error instanceof Error&&!(error instanceof AppError&&error.code==='QUOTA_EXCEEDED')){const redis=await getRedis();await redis.decr(quotaKey(userId,quotaType));}}throw error;}finally{client.release();}
};

export const rewindSwipe=async(userId:string)=>{
  if(!(await getEntitlements(userId)).rewind)throw new AppError(402,'FEATURE_LOCKED','Rewind requires Pepper Plus or higher.',{paywall:'rewind'});
  const client=await pool.connect();
  try{await client.query('BEGIN');const swipe=await swipeRepository.lockLatestSwipe(client,userId);if(!swipe||swipe.action!=='nope'||await swipeRepository.findActiveMatch(client,userId,swipe.swipee_id))throw new AppError(400,'REWIND_UNAVAILABLE','Only your most recent unmatched Nope can be rewound.');await swipeRepository.rewind(client,swipe.id);await client.query('COMMIT');const redis=await getRedis();await Promise.all([redis.sRem(`swiped:${userId}`,swipe.swipee_id),redis.sRem(`dealt:${userId}`,swipe.swipee_id),redis.lPush(`deck:${userId}`,swipe.swipee_id)]);return{rewound:true,target_id:swipe.swipee_id};}catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
};
