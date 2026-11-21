import {api} from '../../../core/api';
import type {DiscoveryCard,Like,LikesResponse,Match,Message,Preferences,Product,Profile} from '../domain/models';

export const appRepository={
  deck:async()=>api<{results:DiscoveryCard[]}>('/discovery/deck?limit=20').then(value=>value.results),
  swipe:(targetId:string,action:'like'|'nope'|'superlike')=>api<{matched:boolean;match?:{id:string}}>('/swipes',{method:'POST',body:JSON.stringify({target_id:targetId,action,client_ts:new Date().toISOString()})}),
  rewind:()=>api('/swipes/rewind',{method:'POST'}),
  boost:()=>api('/billing/boost/activate',{method:'POST'}),
  likes:()=>api<LikesResponse>('/likes/received'),
  matches:async()=>api<{results:Match[]}>('/matches?limit=50').then(value=>value.results),
  messages:async(matchId:string)=>api<{results:Message[]}>(`/matches/${matchId}/messages?limit=50`).then(value=>value.results.reverse()),
  sendMessage:(matchId:string,body:string)=>api<Message>(`/matches/${matchId}/messages`,{method:'POST',body:JSON.stringify({client_id:crypto.randomUUID(),kind:'text',body})}),
  markRead:(matchId:string,messageId:string)=>api(`/matches/${matchId}/read`,{method:'POST',body:JSON.stringify({up_to_message_id:messageId})}),
  unmatch:(matchId:string)=>api(`/matches/${matchId}`,{method:'DELETE'}),
  block:(userId:string)=>api('/safety/blocks',{method:'POST',body:JSON.stringify({user_id:userId})}),
  report:(userId:string,matchId:string,reason:string)=>api('/safety/reports',{method:'POST',body:JSON.stringify({reported_id:userId,match_id:matchId,reason,details:''})}),
  profile:()=>api<Profile>('/profiles/me'),
  updateProfile:(values:Partial<Profile>)=>api<Profile>('/profiles/me',{method:'PATCH',body:JSON.stringify(values)}),
  preferences:()=>api<Preferences>('/profiles/me/preferences'),
  updatePreferences:(values:Preferences)=>api<Preferences>('/profiles/me/preferences',{method:'PATCH',body:JSON.stringify(values)}),
  notificationPreferences:()=>api<Record<string,boolean>>('/notifications/preferences'),
  updateNotifications:(values:Record<string,boolean>)=>api('/notifications/preferences',{method:'PATCH',body:JSON.stringify(values)}),
  products:async()=>api<{results:Product[]}>('/billing/products').then(value=>value.results),
  fakePurchase:(sku:string)=>api('/billing/verify',{method:'POST',body:JSON.stringify({provider:'fake',product_sku:sku,receipt:`web-debug-${crypto.randomUUID()}`,currency:'USD'})}),
  pause:()=>api('/account/pause',{method:'POST'}),
  exportData:()=>api('/account/export'),
  deleteAccount:()=>api('/account',{method:'DELETE',body:JSON.stringify({confirmation:'DELETE'})}),
};

export type {DiscoveryCard,Like,Match,Message,Preferences,Product,Profile};
