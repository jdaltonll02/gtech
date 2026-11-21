# Engineering decisions

## 2026-11-21 — Source architecture location

The architecture specification now lives at its canonical path, `docs/ARCHITECTURE.md`. It was moved from the repository root without changing its contents so the documented source-of-truth rule and the filesystem agree.

## 2026-11-15 — Local toolchain fallback

The host has no Python executable and Flutter initially could not write its SDK state. Flutter was successfully run with narrowly elevated SDK-cache access and its Android/iOS hosts now exist.

## 2026-11-15 — React/Express web architecture

The product owner replaced the original all-Flutter/Django stack. The web client is React + TypeScript + Vite, the server is Express + TypeScript, PostgreSQL/PostGIS remains the system of record, Socket.IO replaces Channels, and BullMQ replaces Celery. Flutter is retained exclusively for Android and iOS. Existing product, privacy, safety, and provider-abstraction requirements continue to apply.
## 2026-11-15 — Reproducible MinIO source image

MinIO stopped publishing current prebuilt Docker images. Local development builds the official security release `RELEASE.2025-10-15T17-29-55Z` from source in `infra/minio/Dockerfile`, matching MinIO's current upstream deployment guidance and avoiding unmaintained third-party images.

## 2026-11-16 — Billing providers and launch prices

Billing is provider-neutral in the service layer. Apple receipts are verified with Apple's signed-data library and configured root certificates; Google receipts use the Android Publisher API and a service-account file. Orange Money and MTN MoMo use a small JSON contract (`reference`, `amount`, `currency`, `msisdn`) against the configured initiation URL and HMAC-SHA256 webhook signatures in `X-Pepper-Signature`. Provider-specific launch integrations can adapt that boundary without changing purchases or entitlements. The fake provider is credential-free for local/test use and is rejected in production.

Initial prices are market-testing defaults, not permanent commercial commitments: Plus is USD 2.99/7.99/34.99, Gold 4.99/12.99/59.99, Platinum 6.99/17.99/79.99 for week/month/six-month terms; local LRD prices are stored alongside them. Consumables launch at USD 2.99 for five Super Likes and USD 3.99 for one Boost. Product rows remain the source shown to clients so prices can be migrated without releases.

## 2026-11-16 — Moderation console boundary

The architecture's Django Admin screens are represented by staff-only Express moderation APIs because the approved server stack is Express rather than Django. They expose a combined queue for pending photos, reports, and selfie verification, plus audited dismiss, warn, ban, photo-removal, and verification-review actions. The React moderation view can consume this boundary without granting direct database access.

## 2026-11-21 — Store notification fail-closed policy

The generic HMAC billing webhook accepts only Orange Money, MTN MoMo, and the non-production fake provider. Apple App Store and Google Play notifications are rejected by that route because their signed payload formats require dedicated provider verification and normalization. They remain unavailable rather than accepting unauthenticated subscription events.

