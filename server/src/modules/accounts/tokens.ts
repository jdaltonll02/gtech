import {createHash} from 'node:crypto';
import jwt, {type JwtPayload} from 'jsonwebtoken';
import type {PoolClient} from 'pg';
import {v7 as uuid7} from 'uuid';
import {config} from '../../config.js';
import {AppError} from '../../core/errors.js';
import {accountRepository} from './repositories.js';

const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
export const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');

export const issueTokenPair = async (client: PoolClient, userId: string, deviceId?: string) => {
  const refreshId = uuid7();
  const access = jwt.sign({sub: userId, type: 'access'}, config.JWT_SECRET, {expiresIn: '15m', jwtid: uuid7()});
  const refresh = jwt.sign({sub: userId, type: 'refresh'}, config.JWT_SECRET, {expiresIn: '30d', jwtid: refreshId});
  await accountRepository.insertRefreshToken(client, {id: refreshId, userId, tokenHash: tokenHash(refresh), expiresAt: new Date(Date.now() + refreshLifetimeMs), ...(deviceId ? {deviceId} : {})});
  return {access, refresh};
};

export const parseToken = (token: string, expectedType: 'access' | 'refresh'): JwtPayload & {sub: string; type: 'access' | 'refresh'} => {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (typeof payload === 'string' || payload.type !== expectedType || typeof payload.sub !== 'string') throw new Error('Invalid token claims');
    return payload as JwtPayload & {sub: string; type: 'access' | 'refresh'};
  } catch {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'The authentication token is invalid or expired.');
  }
};
