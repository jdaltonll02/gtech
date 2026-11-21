# AGENTS.md — standing rules for coding agents in this repo

Project: **Pepper**, a dating app for Liberia. React web client + Flutter Android/iOS clients + Express/PostgreSQL backend.
Source of truth for design decisions: `docs/ARCHITECTURE.md`. If code and that doc disagree, follow the doc or update it in the same change and say why.

## Always
- Track progress in `PROGRESS.md` (phase checklist). Tick items only when their acceptance checks pass.
- Business logic lives in each Express module's `services.ts`; reads live in `repositories.ts`. Routes are thin. Modules call each other only through exported services.
- Every new endpoint: Zod schema, authorization middleware, throttle, OpenAPI schema, tests (happy path + auth + permission + validation error).
- Flutter: feature-first folders (`data/ domain/ application/ presentation/`), Riverpod for state, go_router for navigation, no Dio calls from widgets.
- Use design tokens from `app/lib/core/theme/` — never hard-code colors. Palette is black / red / white only (plus the greys defined there).
- External services (SMS, FCM, payments, moderation, storage) sit behind an interface with a **fake/console implementation** that is the default in dev and tests. All clients and the server must run with zero third-party credentials.
- Keep secrets out of git. Add new settings to `.env.example` with a safe dev default and a comment.

## Never
- Never use Tinder's name, flame logo, gradient, icon set, sounds or copy (e.g. "It's a Match!"). Copy the interaction patterns only.
- Never send another user's coordinates to a client. Distances are computed and rounded server-side.
- Never store or log OTP codes in plain text outside the dev console provider.
- Never use real people's photos in seed data. Generate abstract avatars.
- Never leave `TODO`/`pass`/`NotImplementedError` in a user-facing flow listed as MVP in `docs/ARCHITECTURE.md` §1.

## Commands
| Task | macOS/Linux | Windows (PowerShell) |
|---|---|---|
| Start backend stack | `make up` | `./scripts/dev.ps1 up` |
| Migrate | `make migrate` | `./scripts/dev.ps1 migrate` |
| Seed demo data | `make seed` | `./scripts/dev.ps1 seed` |
| Server tests | `make test-server` | `./scripts/test.ps1 server` |
| Server lint/typecheck | `make lint-server` | `./scripts/test.ps1 server` |
| React web checks | `make test-web` | `./scripts/test.ps1 web` |
| App analyze + tests | `make test-app` | `./scripts/test.ps1 app` |
| Run app on Android emulator | `cd app && flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000` | same |
| Run React web app | `cd web && npm run dev` | same |

## Definition of done for any change
`make lint-server test-server test-web test-app` (or PowerShell equivalents) all green, `PROGRESS.md` updated, docs updated if behaviour changed.
# Stack amendment (2026-11-15)

The product owner has explicitly superseded the original stack rules: use React + TypeScript for `web/`, Express + TypeScript for `server/`, PostgreSQL/PostGIS with explicit SQL migrations, and Flutter only for Android/iOS in `app/`. Express routes remain thin; business rules live in module `services.ts`, reads in `repositories.ts`, and modules call one another through exported services. New endpoints still require validation, permissions, throttling, OpenAPI documentation, and happy/auth/permission/validation tests. Use `npm` scripts for server/web checks. All product, safety, branding, provider-abstraction, secret-management, progress, and definition-of-done rules below remain in force.

