# Pepper operations runbook

This runbook covers local development, client testing, release preparation, and
first-response operations. Commands are run from the repository root unless a
different directory is shown.

## Local prerequisites

- Docker Desktop with Compose v2
- Node.js 22 and npm
- Flutter stable with Android Studio for Android development
- Xcode and CocoaPods on macOS for iOS development
- PowerShell 7 on Windows, or GNU Make on macOS/Linux

Copy `.env.example` to `.env`. The checked-in defaults use console/fake
providers and require no third-party credentials. Never commit `.env`, store
keys, service-account files, signing keystores, or Apple private keys.

## Start and verify the stack

Windows:

```powershell
./scripts/dev.ps1 up
./scripts/dev.ps1 migrate
./scripts/dev.ps1 seed
Invoke-RestMethod http://localhost:8000/api/v1/readyz
```

macOS/Linux:

```bash
make up
make migrate
make seed
curl --fail http://localhost:8000/api/v1/readyz
```

Readiness must return `{"db":"ok","redis":"ok"}`. Useful local services:

| Service | Address |
|---|---|
| React web | `http://localhost:5173` |
| API | `http://localhost:8000/api/v1` |
| OpenAPI JSON | `http://localhost:8000/api/v1/schema` |
| MinIO API / console | `http://localhost:9000` / `http://localhost:9001` |
| Mailpit | `http://localhost:8025` |

Follow application logs with `./scripts/dev.ps1 logs` or
`docker compose logs -f api worker web`. Stop without deleting volumes using
`./scripts/dev.ps1 down` or `make down`. Do not use `docker compose down -v`
unless destruction of all local database, Redis, and object data is intended.

The seeded development login is `+231770000001`; the development-only OTP is
`000000`. The OTP request limit uses a 15-minute window.

## Run clients

React web:

```powershell
cd web
npm run dev
```

Android emulator (the emulator reaches the host through `10.0.2.2`):

```powershell
cd app
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
```

Physical Android phone:

1. Put the phone and development PC on the same trusted LAN.
2. Find the PC's LAN IPv4 address with `ipconfig` (Windows) or `ip addr` /
   `ifconfig` (macOS/Linux).
3. Permit inbound TCP 8000 only on the private network profile.
4. Ensure the API binds to an interface reachable on that LAN.
5. Run `flutter run --dart-define=API_BASE_URL=http://<PC-LAN-IP>:8000`.

The debug Android manifest permits cleartext HTTP. The production manifest
does not opt into cleartext traffic; release builds must use HTTPS.

iOS simulator on the same Mac:

```bash
cd app
flutter run --dart-define=API_BASE_URL=http://localhost:8000
```

## Tests and smoke checks

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test.ps1 all
```

The complete product smoke test requires the running, migrated, seeded stack:

```powershell
cd server
npm run product:smoke
```

See [TESTING.md](TESTING.md) for targeted suites, manual client checks, and
performance budgets.

## Provider configuration

All providers default to safe development implementations. Restart the API and
worker after changing provider settings.

### SMS

- `SMS_PROVIDER=console` prints OTPs only in development.
- For Twilio, set `SMS_PROVIDER=twilio` and all `TWILIO_*` settings.
- For Africa's Talking, set `SMS_PROVIDER=africastalking` and all
  `AFRICASTALKING_*` settings.

Never enable the console provider in production. Verify delivery, sender-name
approval, failure behavior, and OTP throttling before launch.

### Payments

- `PAYMENT_PROVIDER=fake` is development-only and rejected in production.
- Apple requires the bundle/app identifiers, issuer/key IDs, private key file,
  trusted root CA files, environment, and signed notification endpoint.
- Google requires the package name, service-account file, Pub/Sub audience,
  authenticated push identity, and RTDN endpoint.
- Orange Money and MTN MoMo require their API credentials and webhook secrets.

Provider callbacks use `${BILLING_WEBHOOK_BASE_URL}/...`. Test sandbox
purchases, renewals, cancellation, refund, replay, and invalid-signature cases.
Detailed setup is in [BILLING_NOTIFICATIONS.md](BILLING_NOTIFICATIONS.md).

### Firebase push

The server uses `FIREBASE_ENABLED=true` plus
`FIREBASE_CREDENTIALS_FILE=/run/secrets/firebase-service-account.json`.
Production clients also need their platform Firebase configuration and token
registration. The current Flutter project does not yet include the Firebase
client packages/configuration files, so push delivery is a release blocker even
though the server provider is implemented. Keep Firebase disabled until that
wiring and device tests are complete.

### Storage and moderation

Use an S3-compatible private bucket and set `S3_ENDPOINT_URL`, the public signed
URL endpoint, access keys, and bucket name. Keep public bucket listing disabled.
Production must replace `MODERATION_PROVIDER=auto_approve` with a reviewed
moderation workflow; the development auto-approval provider is not acceptable
for user-generated content at launch.

## Production deployment baseline

The repository `docker-compose.yml` is for development: it bind-mounts source,
runs Vite and `tsx watch`, and contains local credentials. Do not deploy it as
the production definition.

For an initial single-VM deployment:

1. Provision a maintained Linux VM, managed PostgreSQL 16 with PostGIS,
   managed/persistent Redis, and private S3-compatible storage.
2. Build the `production` target from `server/Dockerfile`; build `web/` with
   `npm ci && npm run build` and serve `web/dist` as static files.
3. Run separate API and worker containers from the same immutable server image:
   `node dist/index.js` and `node dist/worker.js`.
4. Supply secrets through the platform secret store as mounted files or
   environment variables. Use unique production JWT and field-encryption keys.
5. Run `npm run db:migrate` as a one-off release job before shifting traffic.
6. Put Caddy or an equivalent reverse proxy in front of the API and web app.
   Redirect HTTP to HTTPS, proxy `/ws/` with WebSocket support, and retain the
   original client IP only through trusted proxy configuration.
7. Restrict Postgres, Redis, worker, and object-storage administration ports to
   private networks. Only 80/443 should be internet-facing.
8. Set `NODE_ENV=production`, exact `CORS_ALLOWED_ORIGINS`, production provider
   credentials, and HTTPS webhook/public storage URLs.
9. Verify `/api/v1/healthz`, `/api/v1/readyz`, authentication, media upload,
   one realtime conversation, purchase sandbox flow, and account deletion.

Do not route traffic to a revision whose migrations failed. SQL migrations are
forward-only; rehearse restoration before any destructive schema change.

## Backup and restore

Back up three data classes together:

- PostgreSQL: managed point-in-time recovery plus a daily encrypted logical or
  physical backup.
- Object storage: bucket versioning or replicated backups for profile, chat,
  verification, and export objects.
- Redis: persistence helps recovery, but Redis data must remain rebuildable;
  PostgreSQL is authoritative for durable product state.

At least quarterly, restore into an isolated environment, run migrations, check
row counts and media access, then run `npm run product:smoke`. Record recovery
time and recovery point. Never restore production personal data into developer
machines or an environment with development providers enabled.

## Monitoring and alerts

Minimum launch signals:

- API 5xx rate, latency, restarts, and readiness failures
- Postgres availability, connection saturation, storage, and replication lag
- Redis availability, memory pressure, and BullMQ failed/stalled jobs
- worker failures for photo processing and scheduled account deletion
- OTP delivery/error rate without logging codes or full phone numbers
- media moderation backlog and oldest pending report
- payment verification/webhook failures and signature failures
- WebSocket connection/authentication errors

Scrub authorization headers, tokens, OTPs, exact coordinates, private messages,
and sensitive profile fields from logs and error-reporting systems.

## Incident first response

1. Declare an owner and timestamp; preserve relevant logs and audit records.
2. Determine impact: availability, confidentiality, integrity, payments, safety,
   or moderation.
3. Contain safely: revoke affected credentials, disable a provider, stop a bad
   worker, or roll back application traffic. Do not roll back a database schema
   blindly.
4. For account/safety incidents, use the moderation audit trail and keep the
   reported users separated while investigating.
5. For payment incidents, fail closed and preserve idempotency records.
6. Communicate status without exposing user or investigation details.
7. Recover, validate readiness and product smoke checks, then document root
   cause, affected records, corrective actions, and any notification duties.

## Mobile release commands

Android:

```powershell
cd app
flutter clean
flutter pub get
flutter analyze
flutter test
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.example.com
```

The current Gradle file signs release builds with the debug key. Configure a
protected upload keystore in the release environment before producing anything
for Play Console; never commit the keystore or passwords.

iOS requires macOS, Xcode signing, the Apple capability/profile, and configured
store products:

```bash
cd app
flutter clean
flutter pub get
flutter analyze
flutter test
flutter build ipa --release --dart-define=API_BASE_URL=https://api.example.com
```

Use TestFlight/internal testing first. Complete every unresolved item in
[STORE_COMPLIANCE.md](STORE_COMPLIANCE.md) before submission.
