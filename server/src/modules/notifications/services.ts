import {v7 as uuid7} from 'uuid';
import {pool} from '../../db/pool.js';
import {getPushProvider} from './providers.js';
import {notificationRepository,type NotificationPreferences} from './repositories.js';

const defaults:Omit<NotificationPreferences,'user_id'|'updated_at'>={new_matches:true,messages:true,likes:true,promotions:false,message_previews:true};
export type NotificationKind='new_matches'|'messages'|'likes'|'promotions';
export const sendPush=async(input:{userId:string;kind:NotificationKind;dedupKey:string;title:string;body:string;data:Record<string,string>})=>{
  const client=await pool.connect();const provider=getPushProvider();
  try{const claimed=await notificationRepository.claimLog(client,{id:uuid7(),userId:input.userId,kind:input.kind,dedupKey:input.dedupKey,provider:provider.name});if(!claimed)return false;const preferences=await notificationRepository.preferences(client,input.userId);const effective=preferences??defaults;if(!effective[input.kind]){await notificationRepository.finishLog(client,claimed.id,'skipped');return false;}const tokens=await notificationRepository.deviceTokens(client,input.userId);if(!tokens.length){await notificationRepository.finishLog(client,claimed.id,'skipped');return false;}try{await provider.send({tokens,title:input.title,body:input.kind==='messages'&&!effective.message_previews?'New message':input.body,data:input.data});await notificationRepository.finishLog(client,claimed.id,'sent');return true;}catch(error){await notificationRepository.finishLog(client,claimed.id,'failed',error instanceof Error?error.message:'Push failed');throw error;}}finally{client.release();}
};
export const getNotificationPreferences=async(userId:string)=>{const client=await pool.connect();try{return await notificationRepository.preferences(client,userId)??{user_id:userId,...defaults};}finally{client.release();}};
export const updateNotificationPreferences=async(userId:string,values:Omit<NotificationPreferences,'user_id'|'updated_at'>)=>{const client=await pool.connect();try{return await notificationRepository.upsertPreferences(client,userId,values);}finally{client.release();}};
