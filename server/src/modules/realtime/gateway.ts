import type {Server as HttpServer} from 'node:http';
import {Server,type Socket} from 'socket.io';
import {v7 as uuid7} from 'uuid';
import {ZodError} from 'zod';
import {corsOrigins} from '../../config.js';
import {AppError} from '../../core/errors.js';
import {getRedis} from '../../core/redis.js';
import {parseToken} from '../accounts/tokens.js';

export type RealtimeEnvelope<T=unknown>={type:string;id:string;ts:string;data:T};
export type RealtimeHandlers={sendMessage:(userId:string,data:unknown)=>Promise<unknown>;readMessage:(userId:string,data:unknown)=>Promise<unknown>;typing:(userId:string,data:unknown)=>Promise<unknown>};
let io:Server|undefined;
const socketUsers=new WeakMap<Socket,string>();
const envelope=<T>(type:string,data:T):RealtimeEnvelope<T>=>({type,id:uuid7(),ts:new Date().toISOString(),data});
const tokenFromSocket=(socket:Socket)=>{const auth=(socket.handshake.auth as Record<string,unknown>).token;const query=socket.handshake.query.token;const protocol=socket.handshake.headers['sec-websocket-protocol'];return typeof auth==='string'?auth:typeof query==='string'?query:typeof protocol==='string'?protocol.split(',').map((value)=>value.trim()).find((value)=>value.split('.').length===3):undefined;};
const errorEnvelope=(error:unknown)=>error instanceof AppError?envelope('error',{code:error.code,message:error.message,details:error.details}):error instanceof ZodError?envelope('error',{code:'VALIDATION_ERROR',message:'Event validation failed.',details:error.flatten()}):envelope('error',{code:'INTERNAL_ERROR',message:'An unexpected error occurred.',details:{}});

export const emitToUser=(userId:string,type:string,data:unknown)=>{const value=envelope(type,data);io?.to(`user.${userId}`).emit('event',value);io?.to(`user.${userId}`).emit(type,value);return value;};
export const isUserOnline=async(userId:string)=>(await getRedis()).exists(`presence:${userId}`).then((value)=>value>0);

export const attachRealtime=(server:HttpServer,handlers:RealtimeHandlers)=>{
  io=new Server(server,{path:'/ws/',cors:{origin:corsOrigins},transports:['websocket','polling']});
  io.use((socket,next)=>{const token=tokenFromSocket(socket);if(!token){next(new Error('AUTHENTICATION_REQUIRED'));return;}try{socketUsers.set(socket,parseToken(token,'access').sub);next();}catch{next(new Error('AUTHENTICATION_REQUIRED'));}});
  io.on('connection',(socket)=>{
    const userId=socketUsers.get(socket);if(!userId){socket.disconnect(true);return;}const room=`user.${userId}`;void socket.join(room);
    getRedis().then((redis)=>redis.set(`presence:${userId}`,socket.id,{EX:60})).catch(()=>undefined);
    let eventCount=0;let windowStarted=Date.now();
    const rateAllowed=()=>{if(Date.now()-windowStarted>=60_000){eventCount=0;windowStarted=Date.now();}eventCount+=1;return eventCount<=60;};
    const run=async(type:string,data:unknown,ack?:((value:unknown)=>void))=>{if(!rateAllowed()){const failure=envelope('error',{code:'RATE_LIMITED',message:'Too many realtime events.',details:{}});socket.emit('event',failure);ack?.(failure);return;}try{let result:unknown;if(type==='message.send')result=await handlers.sendMessage(userId,data);else if(type==='message.read')result=await handlers.readMessage(userId,data);else if(type==='typing')result=await handlers.typing(userId,data);else throw new AppError(400,'EVENT_NOT_SUPPORTED','Realtime event type is not supported.');ack?.(envelope(`${type}.ack`,result));}catch(error){const failure=errorEnvelope(error);socket.emit('event',failure);ack?.(failure);}};
    socket.on('ping',(_data:unknown,ack?:((value:unknown)=>void))=>{getRedis().then((redis)=>redis.set(`presence:${userId}`,socket.id,{EX:60})).catch(()=>undefined);const pong=envelope('pong',{});socket.emit('event',pong);ack?.(pong);});
    for(const type of ['message.send','message.read','typing'])socket.on(type,(data:unknown,ack?:((value:unknown)=>void))=>{void run(type,data,ack);});
    socket.on('event',(value:unknown,ack?:((result:unknown)=>void))=>{if(!value||typeof value!=='object')return void run('',value,ack);const candidate=value as {type?:unknown;data?:unknown};void run(typeof candidate.type==='string'?candidate.type:'',candidate.data,ack);});
    socket.on('disconnect',()=>{setTimeout(()=>{void io?.in(room).allSockets().then(async(sockets)=>{if(!sockets.size)await(await getRedis()).del(`presence:${userId}`);});},0);});
  });
  return io;
};
