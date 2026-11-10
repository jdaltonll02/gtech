# Deploying the Express + React app on Hostinger

This repository now runs as one Node 20+ process. Express serves `/api/v1`, `/health`, `/media`, and `frontend/dist` (including SPA fallback routes).

## 1. Neon database setup

Create or select the existing Neon PostgreSQL database and copy its pooled connection string. Set `DATABASE_URL` to the standard Node/Prisma form:

```text
postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

Do not use the Python `postgresql+asyncpg://` prefix. The Node server uses the existing tables unchanged. Its only schema addition is `kv_store`, which persists revoked JWTs, 2FA state, login lockouts, and cache entries when `REDIS_URL` is empty.

Before the first deployment, run from the repository root:

```sh
npm ci --prefix server
npm run prisma:generate --prefix server
npx prisma migrate deploy --schema server/prisma/schema.prisma
```

Back up the Neon database first. The included migration only creates `kv_store` and its expiry index. The older database schema remains owned by the existing Alembic history.

## 2. Hostinger application settings

- Runtime: Node.js 20 or newer
- Build command: `npm run build`
- Start command: `npm start`
- Application port: supplied by Hostinger as `PORT`; do not hard-code it
- Application root: repository root

Required environment variables:

- `SECRET_KEY`: the same long secret used by FastAPI, so existing HS256 tokens remain valid
- `DATABASE_URL`: Neon connection string above
- `ALLOWED_ORIGINS`: comma-separated production origins, such as `https://example.com,https://www.example.com`
- `FRONTEND_URL` and `SITE_URL`: the public HTTPS site URL

Recommended application settings are listed in `server/.env.example`. Configure Hostinger Email with `SMTP_HOST=smtp.hostinger.com`, port `465`, the complete mailbox as `SMTP_USER`, its password, and `SMTP_FROM`. Leave `REDIS_URL` empty to use Neon. Optional integrations emit startup warnings when incomplete.

## 3. External callback URLs

Replace `https://example.com` with the production domain:

- Stripe webhook: `https://example.com/api/v1/payments/stripe/webhook`; subscribe to PaymentIntent success/failure events and set `STRIPE_WEBHOOK_SECRET` to its signing secret.
- MoMo callback: `https://example.com/api/v1/payments/momo/callback`; set the same URL in `MOMO_CALLBACK_URL` and configure a strong `MOMO_CALLBACK_SECRET`.
- PayPal return/cancel URLs are generated from `FRONTEND_URL`; update the PayPal application domain and test both sandbox and live credentials.
- Google OAuth redirect: `https://example.com/api/v1/auth/google/callback`; register it in Google Cloud and set `GOOGLE_REDIRECT_URI` exactly.

Use real sandbox transactions to verify Stripe, PayPal, and MoMo before enabling live credentials.

## 4. Persistence and operations

`LOCAL_MEDIA_ROOT` defaults to `media`. Hostinger application files may be replaced during redeployment, so uploaded media can be lost. The filesystem access is isolated in `src/services/storage.js` for a future object-storage adapter; back up the media directory until then.

Email/image jobs run in process with retries where applicable. Hourly/daily schedules also run in process and therefore pause during restarts or cold starts. Do not configure multiple application instances unless scheduler leadership is added: the singleton guard prevents duplicates within one process, not across multiple processes.

Rate limits use process memory, so counters reset on restart and are not shared between instances. Security state itself remains restart-safe in Neon `kv_store`.

After deployment, verify `/health`, registration/email verification, login/2FA, checkout/webhooks, course enrollment/player/certificates, support email, chatbot ingestion, `/media`, and a direct refresh of a React route.
