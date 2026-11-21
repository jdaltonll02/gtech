import {Router} from 'express';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {receivedLikes} from './services.js';
export const likesRouter=Router();
likesRouter.get('/likes/received',authenticate,async(request,response)=>response.json(await receivedLikes(authenticatedUserId(request))));
