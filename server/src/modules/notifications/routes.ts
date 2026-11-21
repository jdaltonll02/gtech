import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {getNotificationPreferences,updateNotificationPreferences} from './services.js';

export const notificationsRouter=Router();
notificationsRouter.get('/notifications/preferences',authenticate,async(request,response)=>response.json(await getNotificationPreferences(authenticatedUserId(request))));
notificationsRouter.patch('/notifications/preferences',authenticate,rateLimit({windowMs:60_000,limit:20}),async(request,response)=>{const body=z.object({new_matches:z.boolean(),messages:z.boolean(),likes:z.boolean(),promotions:z.boolean(),message_previews:z.boolean()}).strict().parse(request.body);response.json(await updateNotificationPreferences(authenticatedUserId(request),body));});
