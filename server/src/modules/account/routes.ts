import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {deleteAccount,exportAccount,pauseAccount,resumeAccount} from './services.js';

const accountLimit=rateLimit({windowMs:60_000,limit:5});
export const accountRouter=Router();
accountRouter.post('/account/pause',authenticate,accountLimit,async(request,response)=>response.json(await pauseAccount(authenticatedUserId(request))));
accountRouter.post('/account/resume',authenticate,accountLimit,async(request,response)=>response.json(await resumeAccount(authenticatedUserId(request))));
accountRouter.get('/account/export',authenticate,accountLimit,async(request,response)=>response.json(await exportAccount(authenticatedUserId(request))));
accountRouter.delete('/account',authenticate,accountLimit,async(request,response)=>{z.object({confirmation:z.literal('DELETE')}).strict().parse(request.body);response.status(202).json(await deleteAccount(authenticatedUserId(request)));});
