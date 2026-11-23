import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../lib/http-error.js';

export const hashPassword = (password) => bcrypt.hash(password, 12);
export const verifyPassword = (plain, hashed) => bcrypt.compare(plain, hashed);

function createToken(subject, type, expiresIn) {
  return jwt.sign({ type }, config.SECRET_KEY, {
    algorithm: 'HS256',
    subject: String(subject),
    expiresIn,
    jwtid: randomUUID(),
  });
}

export const createAccessToken = (subject) => createToken(subject, 'access', `${config.ACCESS_TOKEN_EXPIRE_MINUTES}m`);
export const createRefreshToken = (subject) => createToken(subject, 'refresh', `${config.REFRESH_TOKEN_EXPIRE_DAYS}d`);

export function decodeToken(token, expectedType = 'access') {
  try {
    const payload = jwt.verify(token, config.SECRET_KEY, { algorithms: ['HS256'] });
    if (payload.type !== expectedType || !payload.sub) throw new Error('Wrong token type');
    return payload;
  } catch {
    throw new HttpError(401, 'Could not validate credentials', { 'WWW-Authenticate': 'Bearer' });
  }
}

export const tokenResponse = (userId) => ({
  access_token: createAccessToken(userId),
  refresh_token: createRefreshToken(userId),
  token_type: 'bearer',
});
