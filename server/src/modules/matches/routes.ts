import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {listMatches,unmatch} from './services.js';

export const matchesRouter=Router();
matchesRouter.get('/matches',authenticate,async(request,response)=>{const query=z.object({cursor:z.string().optional(),limit:z.coerce.number().int().min(1).max(50).default(20)}).parse(request.query);response.json(await listMatches(authenticatedUserId(request),query.cursor,query.limit));});
matchesRouter.delete('/matches/:id',authenticate,rateLimit({windowMs:60_000,limit:30}),async(request,response)=>{await unmatch(authenticatedUserId(request),z.string().uuid().parse(request.params.id));response.status(204).end();});
