import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {messageHistory,readMessages,requestChatUpload,sendMessage,syncSince} from './services.js';

const writeLimit=rateLimit({windowMs:60_000,limit:30});
export const chatRouter=Router();
chatRouter.get('/matches/:id/messages',authenticate,async(request,response)=>{const params=z.object({id:z.string().uuid()}).parse(request.params);const query=z.object({before:z.string().uuid().optional(),limit:z.coerce.number().int().min(1).max(50).default(30)}).parse(request.query);response.json(await messageHistory(authenticatedUserId(request),params.id,query.before,query.limit));});
chatRouter.post('/matches/:id/messages',authenticate,writeLimit,async(request,response)=>{const matchId=z.string().uuid().parse(request.params.id);response.status(201).json(await sendMessage(authenticatedUserId(request),{...request.body as object,match_id:matchId}));});
chatRouter.post('/matches/:id/read',authenticate,writeLimit,async(request,response)=>{const matchId=z.string().uuid().parse(request.params.id);const body=z.object({up_to_message_id:z.string().uuid()}).parse(request.body);response.json(await readMessages(authenticatedUserId(request),{match_id:matchId,...body}));});
chatRouter.post('/chat/upload-url',authenticate,writeLimit,async(request,response)=>{const body=z.object({content_type:z.string(),content_length:z.number().int().positive()}).strict().parse(request.body);response.status(201).json(await requestChatUpload(authenticatedUserId(request),body.content_type,body.content_length));});
chatRouter.get('/sync',authenticate,async(request,response)=>{const query=z.object({since:z.iso.datetime()}).parse(request.query);response.json(await syncSince(authenticatedUserId(request),query.since));});
