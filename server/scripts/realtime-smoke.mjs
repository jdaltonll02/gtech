import {randomUUID} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {io} from 'socket.io-client';
import sharp from 'sharp';

const [userA,userB,outsider]=process.argv.slice(2);
if(!userA||!userB||!outsider)throw new Error('Usage: node scripts/realtime-smoke.mjs <participant-a> <participant-b> <outsider>');
const secret=process.env.JWT_SECRET??'unsafe-local-development-key-change-in-production';
const token=(id)=>jwt.sign({sub:id,type:'access'},secret,{expiresIn:'5m'});
const connect=(id)=>new Promise((resolve,reject)=>{const socket=io('http://localhost:8000',{path:'/ws/',transports:['websocket'],auth:{token:token(id)}});socket.once('connect',()=>resolve(socket));socket.once('connect_error',reject);});
const event=(socket,type,timeout=5000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off('event',listener);reject(new Error(`Timed out waiting for ${type}`));},timeout);const listener=(value)=>{if(value?.type===type){clearTimeout(timer);socket.off('event',listener);resolve(value);}};socket.on('event',listener);});
const unauthorized=await new Promise((resolve)=>{const socket=io('http://localhost:8000',{path:'/ws/',transports:['websocket']});socket.once('connect_error',(error)=>{socket.close();resolve(error.message);});});
const a=await connect(userA);const b=await connect(userB);const c=await connect(outsider);
try{
  const matches=await fetch('http://localhost:8000/api/v1/matches',{headers:{authorization:`Bearer ${token(userA)}`}}).then((response)=>response.json());
  const matchId=matches.results?.[0]?.id;if(!matchId)throw new Error('No active match for participant A');
  const receivedA=event(a,'message.new');const receivedB=event(b,'message.new');
  a.emit('message.send',{match_id:matchId,client_id:randomUUID(),kind:'text',body:'Hello from realtime acceptance'});
  const [messageA,messageB]=await Promise.all([receivedA,receivedB]);
  const typing=event(b,'typing');a.emit('typing',{match_id:matchId,is_typing:true});await typing;
  const warningA=event(a,'message.new');const warningB=event(b,'message.new');b.emit('message.send',{match_id:matchId,client_id:randomUUID(),kind:'text',body:'Message me on WhatsApp +231 77 000 000'});const[,warningMessage]=await Promise.all([warningA,warningB]);
  const image=await sharp({create:{width:80,height:80,channels:3,background:'#e0102d'}}).webp().toBuffer();
  const signed=await fetch('http://localhost:8000/api/v1/chat/upload-url',{method:'POST',headers:{authorization:`Bearer ${token(userA)}`,'content-type':'application/json'},body:JSON.stringify({content_type:'image/webp',content_length:image.length})}).then((response)=>response.json());
  const upload=await fetch(signed.upload_url,{method:'PUT',headers:signed.required_headers,body:image});if(!upload.ok)throw new Error(`Chat image upload failed: ${upload.status}`);
  const imageMessage=await fetch(`http://localhost:8000/api/v1/matches/${matchId}/messages`,{method:'POST',headers:{authorization:`Bearer ${token(userA)}`,'content-type':'application/json'},body:JSON.stringify({client_id:randomUUID(),kind:'image',media_key:signed.key})}).then((response)=>response.json());
  const denied=event(c,'error');c.emit('message.send',{match_id:matchId,client_id:randomUUID(),kind:'text',body:'Not allowed'});const deniedEvent=await denied;
  let receiptDelivered=false;const receiptListener=(value)=>{if(value?.type==='message.read')receiptDelivered=true;};a.on('event',receiptListener);b.emit('message.read',{match_id:matchId,up_to_message_id:messageB.data.id});await new Promise((resolve)=>setTimeout(resolve,300));a.off('event',receiptListener);
  const history=await fetch(`http://localhost:8000/api/v1/matches/${matchId}/messages`,{headers:{authorization:`Bearer ${token(userA)}`}}).then((response)=>response.json());
  const sync=await fetch(`http://localhost:8000/api/v1/sync?since=${encodeURIComponent(new Date(Date.now()-60_000).toISOString())}`,{headers:{authorization:`Bearer ${token(userA)}`}}).then((response)=>response.json());
  if(!warningMessage.data.safety_warning||imageMessage.kind!=='image'||!imageMessage.media_url||deniedEvent.data.code!=='PERMISSION_DENIED'||receiptDelivered||history.results?.length<3||sync.messages?.length<3)throw new Error(JSON.stringify({warningMessage,imageMessage,deniedEvent,receiptDelivered,history,sync}));
  console.log(JSON.stringify({unauthorized,message_id:messageA.data.id,both_received:messageA.data.id===messageB.data.id,typing_relayed:true,safety_warning:true,image_message:true,nonparticipant_code:deniedEvent.data.code,free_read_receipt_delivered:receiptDelivered,history_count:history.results.length,sync_messages:sync.messages.length},null,2));
}finally{a.close();b.close();c.close();}
