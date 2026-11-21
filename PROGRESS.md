# Pepper implementation progress (React + Express + SQL web, Flutter mobile)

Acceptance boxes are checked only after the corresponding checks pass.

## Phase 0 — Scaffold & tooling

- [x] Monorepo directory structure and cross-platform scripts
- [x] Full Docker Compose stack with all service health checks verified
- [x] Express configuration, SQL migrations, and environment template
- [x] Server/Web lint, typing, tests, and Flutter lint configuration
- [x] CI workflows
- [x] Health and readiness endpoints verified against PostGIS and Redis
- [x] Flutter template analyzes cleanly (`flutter analyze`; widget test also passes)

## Phase 1 — Accounts, profiles, media

- [x] Core UUIDv7, pagination, errors, geo and distance helpers
- [x] OTP/JWT/social auth/devices and SMS providers
- [x] Profiles, preferences, locations, catalogues, encryption
- [x] Photo upload and processing pipeline
- [x] Phase acceptance tests and clean OpenAPI generation

## Phase 2 — Discovery, swipes, matches

- [x] Candidate generation, scoring, diversification, and deck cache
- [x] Swipes, quotas, race-safe matching, rewind
- [x] Likes You and matches APIs
- [x] Demo seed command and phase acceptance tests

## Phase 3 — Realtime chat & notifications

- [x] Authenticated websocket protocol and presence
- [x] Chat, sync, receipts, image messages, safety warnings
- [x] Push providers and notification preferences
- [x] Phase acceptance tests

## Phase 4 — Billing & premium

- [x] Products, purchases, subscriptions, wallets and providers
- [x] Entitlement gates and premium features
- [x] Phase acceptance tests

## Phase 5 — Safety & lifecycle

- [x] Blocks, reports, verification and moderation audit
- [x] Pause, export, deletion and moderation admin
- [x] Phase acceptance tests

## Phase 6 — React web and Flutter mobile foundation

- [x] Feature-first client foundation, networking, realtime, router, storage
- [x] Responsive React web shell, API-backed feature pages, Flutter mobile platform configuration and shared design system
- [x] Analyze, launch and golden acceptance checks

## Phase 7 — Flutter features

- [x] Auth and onboarding
- [ ] Discovery, match celebration, likes, chats
- [ ] Profile, settings, paywall, safety and Explore stub
- [ ] Widget, golden and integration acceptance checks

## Phase 8 — Hardening & release

- [x] Versioned baseline, credential ignore rules and repeatable secret scan
- [x] Server, web, app and security CI workflow definitions
- [ ] Remote branch protection and required CI checks (no Git remote configured)
- [x] Generic billing webhook fails closed for unverified Apple/Google events
- [x] Dedicated Apple and Google signed notification verification
- [x] Realtime clients, reconnect/offline reconciliation and gateway integration tests
- [ ] Cross-client realtime end-to-end tests against the complete local stack
- [x] Local-stack authentication, discovery, match, chat and fake-purchase smoke workflow
- [x] React behavior coverage for Explore, Likes, Chats, Profile, Settings and Upgrade
- [ ] Browser-level visual and accessibility acceptance pass
- [x] React keyboard, semantic, narrow-screen, reduced-motion, offline and low-bandwidth hardening
- [ ] Flutter accessibility audit and measured web/mobile performance budgets
- [ ] Runbook, API and store-compliance docs
- [ ] Full test/build/coverage acceptance checks
