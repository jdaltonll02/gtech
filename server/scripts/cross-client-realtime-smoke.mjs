import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import {io} from 'socket.io-client';
import {v7 as uuid7} from 'uuid';

const apiBase=(process.env.API_BASE_URL??'http://localhost:8000/api/v1').replace(/\/$/,'');
const socketOrigin=new URL(apiBase).origin;
const databaseUrl=process.env.DATABASE_URL??'postgresql://pepper:pepper@localhost:5432/pepper';
const secret=process.env.JWT_SECRET??'unsafe-local-development-key-change-in-production';
const {Pool}=pg;
const pool=new Pool({connectionString:databaseUrl});

const ids={web:uuid7(),mobile:uuid7(),match:uuid7()};
const tokens={
  web:jwt.sign({sub:ids.web,type:'access'},secret,{expiresIn:'10m'}),
  mobile:jwt.sign({sub:ids.mobile,type:'access'},secret,{expiresIn:'10m'}),
};
const sockets=new Set();

const check=(condition,message,details)=>{
  if(!condition)throw new Error(`${message}${details===undefined?'':`: ${JSON.stringify(details)}`}`);
};
const api=async(path,{method='GET',token=tokens.web,body}={})=>{
  const response=await fetch(`${apiBase}${path}`,{
    method,
    headers:{authorization:`Bearer ${token}`,...(body===undefined?{}:{'content-type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body),
  });
  const payload=response.status===204?null:await response.json().catch(()=>null);
  return{response,payload};
};
const connect=(token,label)=>new Promise((resolve,reject)=>{
  const socket=io(socketOrigin,{path:'/ws/',transports:['websocket'],auth:{token},query:{client:label},reconnection:false});
  const timer=setTimeout(()=>{socket.close();reject(new Error(`${label} socket connection timed out`));},5000);
  socket.once('connect',()=>{clearTimeout(timer);sockets.add(socket);resolve(socket);});
  socket.once('connect_error',(error)=>{clearTimeout(timer);socket.close();reject(error);});
});
const waitFor=(socket,type,predicate=()=>true,timeout=5000)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{socket.off('event',listener);reject(new Error(`Timed out waiting for ${type}`));},timeout);
  const listener=(value)=>{if(value?.type===type&&predicate(value)){clearTimeout(timer);socket.off('event',listener);resolve(value);}};
  socket.on('event',listener);
});
const emitAck=(socket,type,data,timeout=5000)=>new Promise((resolve,reject)=>{
  socket.timeout(timeout).emit(type,data,(error,value)=>error?reject(error):resolve(value));
});
const close=async(socket)=>{
  if(!socket?.connected){socket?.close();sockets.delete(socket);return;}
  await new Promise((resolve)=>{socket.once('disconnect',resolve);socket.close();});
  sockets.delete(socket);
};

const setup=async()=>{
  const [userA,userB]=[ids.web,ids.mobile].sort();
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query("INSERT INTO users(id,phone_e164)VALUES($1,$2),($3,$4)",[ids.web,`+23188${Date.now().toString().slice(-7)}`,ids.mobile,`+23189${Date.now().toString().slice(-7)}`]);
    await client.query("INSERT INTO profiles(user_id,display_name,birth_date,gender,county,completeness)VALUES($1,'Realtime Web',DATE '1995-01-01','woman','Montserrado',100),($2,'Realtime Mobile',DATE '1994-01-01','man','Montserrado',100)",[ids.web,ids.mobile]);
    await client.query('INSERT INTO discovery_preferences(user_id)VALUES($1),($2)',[ids.web,ids.mobile]);
    await client.query('INSERT INTO matches(id,user_a_id,user_b_id)VALUES($1,$2,$3)',[ids.match,userA,userB]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}finally{client.release();}
};
const cleanup=async()=>{
  for(const socket of sockets)socket.close();
  await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[ids.web,ids.mobile]]).catch((error)=>console.warn('Realtime smoke cleanup failed',error));
  await pool.end();
};

try{
  const readiness=await fetch(`${apiBase}/readyz`);
  check(readiness.ok,'API is not ready; start and migrate the complete local stack',await readiness.text());
  await setup();

  const unauthorized=await new Promise((resolve)=>{
    const socket=io(socketOrigin,{path:'/ws/',transports:['websocket'],reconnection:false});
    const timer=setTimeout(()=>{socket.close();resolve('timeout');},5000);
    socket.once('connect_error',(error)=>{clearTimeout(timer);socket.close();resolve(error.message);});
  });
  check(unauthorized==='AUTHENTICATION_REQUIRED','Unauthenticated socket did not fail closed',unauthorized);

  const web=await connect(tokens.web,'react-web');
  let mobile=await connect(tokens.mobile,'flutter-mobile');
  const since=new Date(Date.now()-1000).toISOString();

  const clientId=randomUUID();
  const webMessage=waitFor(web,'message.new');
  const mobileMessage=waitFor(mobile,'message.new');
  const sendAck=await emitAck(web,'message.send',{match_id:ids.match,client_id:clientId,kind:'text',body:'Cross-client realtime acceptance'});
  const[firstOnWeb,firstOnMobile]=await Promise.all([webMessage,mobileMessage]);
  check(sendAck.type==='message.send.ack','Web send acknowledgement missing',sendAck);
  check(firstOnWeb.data.id===firstOnMobile.data.id&&firstOnWeb.data.id===sendAck.data.id,'Clients received different message identities',{sendAck,firstOnWeb,firstOnMobile});

  const retryAck=await emitAck(web,'message.send',{match_id:ids.match,client_id:clientId,kind:'text',body:'Cross-client realtime acceptance'});
  check(retryAck.data.id===sendAck.data.id,'Idempotent retry created another message',{sendAck,retryAck});

  const typingEvent=waitFor(web,'typing',(value)=>value.data?.is_typing===true);
  const typingAck=await emitAck(mobile,'typing',{match_id:ids.match,is_typing:true});
  await typingEvent;
  check(typingAck.data.relayed===true,'Mobile typing acknowledgement missing',typingAck);

  const readAck=await emitAck(mobile,'message.read',{match_id:ids.match,up_to_message_id:firstOnMobile.data.id});
  check(readAck.data.up_to_message_id===firstOnMobile.data.id,'Read acknowledgement was incorrect',readAck);
  const history=await api(`/matches/${ids.match}/messages?limit=10`,{token:tokens.mobile});
  check(history.response.ok&&history.payload.results.some((message)=>message.id===firstOnMobile.data.id&&message.read_at),'Read state was not persisted',history.payload);

  await close(mobile);
  const offlineId=randomUUID();
  const senderCopy=waitFor(web,'message.new',(value)=>value.data?.client_id===offlineId);
  const offlineAck=await emitAck(web,'message.send',{match_id:ids.match,client_id:offlineId,kind:'text',body:'Created while mobile was offline'});
  await senderCopy;
  mobile=await connect(tokens.mobile,'flutter-mobile-reconnected');
  const pong=await emitAck(mobile,'ping',{});
  check(pong.type==='pong','Reconnected mobile heartbeat failed',pong);
  const sync=await api(`/sync?since=${encodeURIComponent(since)}`,{token:tokens.mobile});
  check(sync.response.ok&&sync.payload.messages.some((message)=>message.id===offlineAck.data.id),'Reconnect sync missed the offline message',sync.payload);

  const removedOnWeb=waitFor(web,'match.removed',(value)=>value.data?.match_id===ids.match);
  const removedOnMobile=waitFor(mobile,'match.removed',(value)=>value.data?.match_id===ids.match);
  const removal=await api(`/matches/${ids.match}`,{method:'DELETE',token:tokens.web});
  check(removal.response.status===204,'Unmatch request failed',{status:removal.response.status,payload:removal.payload});
  await Promise.all([removedOnWeb,removedOnMobile]);
  const blocked=await api(`/matches/${ids.match}/messages`,{method:'POST',token:tokens.mobile,body:{client_id:randomUUID(),kind:'text',body:'Must not send'}});
  check(blocked.response.status===409&&blocked.payload?.error?.code==='THREAD_READ_ONLY','Removed thread still accepted messages',{status:blocked.response.status,payload:blocked.payload});
  const removalSync=await api(`/sync?since=${encodeURIComponent(since)}`,{token:tokens.mobile});
  check(removalSync.response.ok&&removalSync.payload.removals.some((item)=>item.id===ids.match),'Reconnect sync missed match removal',removalSync.payload);

  console.info(JSON.stringify({
    unauthorized_rejected:true,
    web_to_mobile_delivery:true,
    idempotent_retry:true,
    mobile_to_web_typing:true,
    read_persisted:true,
    reconnect_heartbeat:true,
    offline_sync:true,
    removal_delivered_to_both:true,
    removal_synced:true,
    removed_thread_rejected:true,
  },null,2));
}finally{await cleanup();}
