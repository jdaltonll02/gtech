import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate, authenticatedUserId} from '../../core/auth.js';
import {logout, registerDevice, requestOtp, rotateRefreshToken, socialSignIn, unregisterDevice, verifyOtp} from './services.js';

export const accountsRouter = Router();
const accountWriteLimit=rateLimit({windowMs:60_000,limit:30});
accountsRouter.post('/otp/request', rateLimit({windowMs: 15 * 60_000, limit: 20}), async (request, response) => {
  const body = z.object({phone: z.string().max(30)}).parse(request.body);
  response.status(201).json(await requestOtp({phone: body.phone, ...(request.ip ? {ip: request.ip} : {})}));
});
accountsRouter.post('/otp/verify', accountWriteLimit, async (request, response) => {
  const body = z.object({challenge_id: z.string().uuid(), code: z.string().regex(/^\d{6}$/)}).parse(request.body);
  response.json(await verifyOtp({challengeId: body.challenge_id, code: body.code}));
});
accountsRouter.post('/refresh', accountWriteLimit, async (request, response) => {
  const body = z.object({refresh: z.string().min(20)}).parse(request.body);
  response.json(await rotateRefreshToken(body.refresh));
});
accountsRouter.post('/logout', accountWriteLimit, async (request, response) => {
  const body = z.object({refresh: z.string().min(20)}).parse(request.body);
  await logout(body.refresh);
  response.status(204).end();
});
accountsRouter.post('/social/:provider', accountWriteLimit, async (request, response) => {
  const provider = z.enum(['google', 'apple']).parse(request.params.provider);
  const body = z.object({id_token: z.string().min(20)}).parse(request.body);
  response.json(await socialSignIn(provider, body.id_token));
});
accountsRouter.post('/devices', authenticate, accountWriteLimit, async (request, response) => {
  const body = z.object({platform: z.enum(['android', 'ios', 'web']), fcm_token: z.string().max(512).default(''), app_version: z.string().max(40).default('')}).parse(request.body);
  response.status(201).json(await registerDevice(authenticatedUserId(request), {platform: body.platform, fcmToken: body.fcm_token, appVersion: body.app_version}));
});
accountsRouter.delete('/devices/:id', authenticate, accountWriteLimit, async (request, response) => {
  await unregisterDevice(authenticatedUserId(request), z.string().uuid().parse(request.params.id));
  response.status(204).end();
});
