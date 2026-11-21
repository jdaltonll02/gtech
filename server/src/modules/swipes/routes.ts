import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {createSwipe,getQuotas,rewindSwipe} from './services.js';

const writeLimit=rateLimit({windowMs:60_000,limit:60});
export const swipesRouter=Router();
swipesRouter.post('/swipes',authenticate,writeLimit,async(request,response)=>{const body=z.object({target_id:z.string().uuid(),action:z.enum(['like','nope','superlike']),client_ts:z.iso.datetime().optional()}).strict().parse(request.body);response.status(201).json(await createSwipe(authenticatedUserId(request),{targetId:body.target_id,action:body.action,clientTs:body.client_ts}));});
swipesRouter.get('/swipes/quotas',authenticate,async(request,response)=>response.json(await getQuotas(authenticatedUserId(request))));
swipesRouter.post('/swipes/rewind',authenticate,writeLimit,async(request,response)=>response.json(await rewindSwipe(authenticatedUserId(request))));
