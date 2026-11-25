import 'dotenv/config';
import { z } from 'zod';

const bool = z.string().default('false').transform((value) => value.toLowerCase() === 'true');
const optional = z.string().default('');

const schema = z.object({
  APP_NAME: z.string().default('Portfolio CMS API'),
  APP_VERSION: z.string().default('1.0.0'),
  DEBUG: bool,
  ENVIRONMENT: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  SECRET_KEY: z.string().min(32, 'SECRET_KEY must contain at least 32 characters'),
  ALGORITHM: z.literal('HS256').default('HS256'),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive().default(30),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().int().positive().default(7),
  DATABASE_URL: z.string().url().refine((value) => /^postgres(ql)?:/.test(value), 'DATABASE_URL must be PostgreSQL'),
  DATABASE_URL_SYNC: optional,
  REDIS_URL: optional,
  LOCAL_MEDIA_ROOT: z.string().default('media'),
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PUBLISHABLE_KEY: optional,
  PAYPAL_CLIENT_ID: optional,
  PAYPAL_CLIENT_SECRET: optional,
  PAYPAL_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  PAYMENT_CURRENCY: z.enum(['USD', 'EUR']).default('USD'),
  MOMO_SUBSCRIPTION_KEY: optional,
  MOMO_API_USER: optional,
  MOMO_API_KEY: optional,
  MOMO_BASE_URL: z.string().url().default('https://sandbox.momodeveloper.mtn.com'),
  MOMO_ENVIRONMENT: z.string().default('sandbox'),
  MOMO_CALLBACK_URL: optional,
  MOMO_CALLBACK_SECRET: optional,
  TAX_RATE: z.coerce.number().min(0).default(0.08),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  FIRST_SUPERADMIN_EMAIL: optional,
  FIRST_SUPERADMIN_PASSWORD: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:3000/api/v1/auth/google/callback'),
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  SMTP_FROM: optional,
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  // Hugging Face Inference Providers (all AI features: chatbot, classroom assistant, document embeddings)
  HF_TOKEN: optional,
  HF_BASE_URL: z.string().url().default('https://router.huggingface.co/v1'),
  HF_CHAT_MODEL: z.string().default('openai/gpt-oss-120b'),
  HF_EMBEDDING_MODEL: z.string().default('thenlper/gte-large'),
  HF_EMBEDDING_PROVIDER: z.string().default('auto'),
  SITE_URL: z.string().url().default('https://localhost:5173'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid server configuration:\n${details}`);
}

export const config = Object.freeze({
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
});

const optionalIntegrations = {
  SMTP: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'],
  GoogleOAuth: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  AI: ['HF_TOKEN'],
  Stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  PayPal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  MoMo: ['MOMO_SUBSCRIPTION_KEY', 'MOMO_API_USER', 'MOMO_API_KEY', 'MOMO_CALLBACK_URL', 'MOMO_CALLBACK_SECRET'],
};

export function warnForMissingIntegrations(logger = console) {
  for (const [name, keys] of Object.entries(optionalIntegrations)) {
    const missing = keys.filter((key) => !config[key]);
    if (missing.length) logger.warn(`${name} integration disabled or incomplete; missing ${missing.join(', ')}`);
  }
}
