import {Router} from 'express';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {getDeck,getTopPicks} from './services.js';
export const discoveryRouter=Router();
discoveryRouter.get('/discovery/deck',authenticate,async(request,response)=>{const query=z.object({limit:z.coerce.number().int().min(1).max(20).default(20)}).parse(request.query);response.json(await getDeck(authenticatedUserId(request),query.limit));});
discoveryRouter.get('/discovery/top-picks',authenticate,async(request,response)=>response.json(await getTopPicks(authenticatedUserId(request))));
