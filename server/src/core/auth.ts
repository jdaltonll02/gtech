import type {NextFunction, Request, Response} from 'express';
import {AppError} from './errors.js';
import {parseToken} from '../modules/accounts/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express exposes request augmentation through its global namespace.
  namespace Express {
    interface Request { userId?: string }
  }
}

export const authenticate = (request: Request, _response: Response, next: NextFunction): void => {
  const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
  request.userId = parseToken(token, 'access').sub;
  next();
};

export const authenticatedUserId = (request: Request): string => {
  if (!request.userId) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Sign in to continue.');
  return request.userId;
};
