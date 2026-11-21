import type {NextFunction,Request,Response} from 'express';
import {authenticatedUserId} from '../../core/auth.js';
import {AppError} from '../../core/errors.js';
import {isStaff} from './services.js';

export const requireStaff=async(request:Request,_response:Response,next:NextFunction)=>{if(!await isStaff(authenticatedUserId(request)))throw new AppError(403,'PERMISSION_DENIED','Staff access is required.');next();};
