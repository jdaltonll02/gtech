import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {requireStaff} from './permissions.js';
import {blockUser,getModerationQueue,moderatePhoto,moderateReport,reportUser,reviewVerification,startVerification,submitVerification,unblockUser} from './services.js';

const safetyLimit=rateLimit({windowMs:60_000,limit:20});
const staff=[authenticate,requireStaff] as const;
export const safetyRouter=Router();
safetyRouter.post('/safety/blocks',authenticate,safetyLimit,async(request,response)=>{const body=z.object({user_id:z.uuid()}).strict().parse(request.body);response.status(201).json(await blockUser(authenticatedUserId(request),body.user_id));});
safetyRouter.delete('/safety/blocks/:userId',authenticate,safetyLimit,async(request,response)=>response.json(await unblockUser(authenticatedUserId(request),z.uuid().parse(request.params.userId))));
safetyRouter.post('/safety/reports',authenticate,safetyLimit,async(request,response)=>{const body=z.object({reported_id:z.uuid(),reason:z.enum(['fake_profile','underage','harassment','scam','nudity','offensive','other']),details:z.string().trim().max(1000).default(''),message_id:z.uuid().optional(),match_id:z.uuid().optional()}).strict().parse(request.body);response.status(201).json(await reportUser(authenticatedUserId(request),{reportedId:body.reported_id,reason:body.reason,details:body.details,...(body.message_id?{messageId:body.message_id}:{}),...(body.match_id?{matchId:body.match_id}:{})}));});
safetyRouter.post('/safety/verification/start',authenticate,safetyLimit,async(request,response)=>response.status(201).json(await startVerification(authenticatedUserId(request))));
safetyRouter.post('/safety/verification/submit',authenticate,safetyLimit,async(request,response)=>{const body=z.object({verification_id:z.uuid(),key:z.string().max(500)}).strict().parse(request.body);response.json(await submitVerification(authenticatedUserId(request),body.verification_id,body.key));});
safetyRouter.get('/admin/moderation/queue',...staff,async(_request,response)=>response.json(await getModerationQueue()));
safetyRouter.post('/admin/moderation/reports/:id',...staff,safetyLimit,async(request,response)=>{const body=z.object({action:z.enum(['dismiss','warn','ban']),notes:z.string().max(1000).default('')}).strict().parse(request.body);response.json(await moderateReport(authenticatedUserId(request),z.uuid().parse(request.params.id),body.action,body.notes));});
safetyRouter.post('/admin/moderation/photos/:id/remove',...staff,safetyLimit,async(request,response)=>{const body=z.object({notes:z.string().max(1000).default('')}).strict().parse(request.body);response.json(await moderatePhoto(authenticatedUserId(request),z.uuid().parse(request.params.id),body.notes));});
safetyRouter.post('/admin/moderation/verifications/:id',...staff,safetyLimit,async(request,response)=>{const body=z.object({approved:z.boolean(),notes:z.string().max(1000).default('')}).strict().parse(request.body);response.json(await reviewVerification(authenticatedUserId(request),z.uuid().parse(request.params.id),body.approved,body.notes));});
