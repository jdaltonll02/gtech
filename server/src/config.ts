import {createHash} from 'node:crypto';
import {z} from 'zod';

const legacySecret = process.env.SECRET_KEY;
const derivedSecret = (purpose: string) => legacySecret
  ? createHash('sha256').update(`pepper:${purpose}:${legacySecret}`).digest('hex')
  : undefined;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().url().default('postgresql://pepper:pepper@localhost:5432/pepper'),
  REDIS_URL: z.string().url().default('redis://localhost:6379/0'),
  JWT_SECRET: z.string().min(32).default(derivedSecret('jwt') ?? 'unsafe-local-development-key-change-in-production'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  SMS_PROVIDER: z.enum(['console', 'twilio', 'africastalking']).default('console'),
  FIELD_ENCRYPTION_KEY: z.string().min(16).default(derivedSecret('field-encryption') ?? 'unsafe-local-field-key-change-me'),
  S3_ENDPOINT_URL: z.string().url().default('http://localhost:9000'),
  S3_PUBLIC_ENDPOINT_URL: z.string().url().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('pepper'),
  S3_SECRET_KEY: z.string().default('pepper-local-secret'),
  S3_BUCKET: z.string().default('pepper-media'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  APPLE_CLIENT_ID: z.string().default(''),
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_FROM_NUMBER: z.string().default(''),
  AFRICASTALKING_API_KEY: z.string().default(''),
  AFRICASTALKING_USERNAME: z.string().default('sandbox'),
  AFRICASTALKING_SENDER_ID: z.string().default('Pepper'),
  MODERATION_PROVIDER: z.enum(['auto_approve', 'manual']).default('auto_approve'),
  FIREBASE_ENABLED: z.stringbool().default(false),
  FIREBASE_CREDENTIALS_FILE: z.string().default(''),
  PAYMENT_PROVIDER: z.enum(['fake','apple','google','orange_money','mtn_momo']).default('fake'),
  APPLE_BUNDLE_ID: z.string().default('com.easytechsolutionz.pepper'),
  APPLE_ISSUER_ID: z.string().default(''),
  APPLE_KEY_ID: z.string().default(''),
  APPLE_PRIVATE_KEY_FILE: z.string().default(''),
  APPLE_ROOT_CA_FILES: z.string().default(''),
  APPLE_ENVIRONMENT: z.enum(['sandbox','production']).default('sandbox'),
  APPLE_APP_ID: z.preprocess(value=>value===''?undefined:value,z.coerce.number().int().positive().optional()),
  GOOGLE_PACKAGE_NAME: z.string().default('com.easytechsolutionz.pepper'),
  GOOGLE_SERVICE_ACCOUNT_FILE: z.string().default(''),
  GOOGLE_PUBSUB_AUDIENCE: z.string().default(''),
  GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: z.string().email().or(z.literal('')).default(''),
  ORANGE_MONEY_API_URL: z.string().default(''),
  ORANGE_MONEY_API_KEY: z.string().default(''),
  ORANGE_MONEY_WEBHOOK_SECRET: z.string().default(''),
  MTN_MOMO_API_URL: z.string().default(''),
  MTN_MOMO_API_KEY: z.string().default(''),
  MTN_MOMO_WEBHOOK_SECRET: z.string().default(''),
  BILLING_WEBHOOK_BASE_URL: z.string().url().default('http://localhost:8000/api/v1/billing/webhooks'),
});

export const config = schema.parse(process.env);
if (config.NODE_ENV === 'production' && (config.JWT_SECRET.startsWith('unsafe-') || config.FIELD_ENCRYPTION_KEY.startsWith('unsafe-'))) {
  throw new Error('JWT_SECRET and FIELD_ENCRYPTION_KEY must be set in production');
}
export const corsOrigins = config.CORS_ALLOWED_ORIGINS.split(',').map((value) => value.trim());
