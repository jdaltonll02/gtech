import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate,authenticatedUserId} from '../../core/auth.js';
import {confirmPhoto,removePhoto,reorderPhotos,requestPhotoUpload} from './services.js';

const uploadLimit=rateLimit({windowMs:60_000,limit:20});
export const mediaRouter=Router();
mediaRouter.post('/media/photos/upload-url',authenticate,uploadLimit,async(request,response)=>{const body=z.object({content_type:z.string(),content_length:z.number().int().positive()}).strict().parse(request.body);response.status(201).json(await requestPhotoUpload(authenticatedUserId(request),body.content_type,body.content_length));});
mediaRouter.post('/media/photos',authenticate,uploadLimit,async(request,response)=>{const body=z.object({key:z.string().max(500),position:z.number().int().min(0).max(8)}).strict().parse(request.body);response.status(202).json(await confirmPhoto(authenticatedUserId(request),body.key,body.position));});
mediaRouter.patch('/media/photos/reorder',authenticate,uploadLimit,async(request,response)=>{const body=z.object({photo_ids:z.array(z.string().uuid()).max(9)}).strict().parse(request.body);response.json({results:await reorderPhotos(authenticatedUserId(request),body.photo_ids)});});
mediaRouter.delete('/media/photos/:id',authenticate,uploadLimit,async(request,response)=>{await removePhoto(authenticatedUserId(request),z.string().uuid().parse(request.params.id));response.status(204).end();});
