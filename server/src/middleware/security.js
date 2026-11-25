import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https:'],
      mediaSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: config.ENVIRONMENT === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  crossOriginEmbedderPolicy: false,
});

export function permissionsPolicy(_request, response, next) {
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
});

const limiterOptions = (limit) => ({
  windowMs: 60_000,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ detail: 'Rate limit exceeded. Please slow down.' }),
});

export const globalLimiter = rateLimit(limiterOptions(config.RATE_LIMIT_PER_MINUTE));
export const limit3 = rateLimit(limiterOptions(3));
export const limit5 = rateLimit(limiterOptions(5));
export const limit10 = rateLimit(limiterOptions(10));
