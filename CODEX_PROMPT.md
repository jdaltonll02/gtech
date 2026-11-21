# Prompt for Codex — build "Pepper", a Tinder-style dating app for Liberia

> Paste everything below the line into Codex, opened at the root of this workspace.
> Before you do, make sure `AGENTS.md` and `docs/ARCHITECTURE.md` are in the workspace root / `docs/` folder.

---

You are the lead engineer building **Pepper**, a production-quality dating app for Liberia (and the Liberian diaspora) with familiar card-based dating interaction patterns, branded in **black, red and white**. It runs as a React web app and Flutter Android/iOS apps, backed by an Express/PostgreSQL API with WebSockets.

## 0. Read first, then work autonomously

1. Read `AGENTS.md` and `docs/ARCHITECTURE.md` completely. **`docs/ARCHITECTURE.md` is the specification** — data model (§6), flows (§7), recommendation engine (§8), WebSocket protocol (§9), REST endpoints (§10), entitlements (§11), safety (§12), Liberia specifics (§13), Flutter architecture (§14), design system (§15). Implement what it says; where it is silent, choose the simplest robust option and record the decision in `docs/DECISIONS.md`.
2. Create `PROGRESS.md` with every phase and task below as a checklist. Update it as you go.
3. Work through the phases **in order**. At the end of each phase, run that phase's acceptance checks, fix failures, tick the boxes, then continue. **Do not stop after scaffolding or after the backend — the job is finished only when all phases are complete.**
4. Do not ask me questions unless something is truly blocking; make the reasonable choice, note it in `docs/DECISIONS.md`, and keep going.
5. If a command can't run in your environment (e.g. no Docker daemon, no Android SDK), still write the complete code, run whatever you *can*, and list exactly what I must run locally in the final report. Geo code must be tested against real PostGIS (Docker or a local install) — do not swap in SQLite/SpatiaLite to make tests pass.

## 1. Non-negotiables

- **Stack** — Flutter 3 stable / Dart 3 (Riverpod, go_router, Dio, freezed, web_socket_channel); Python 3.12, Django 5, DRF, SimpleJWT, drf-spectacular, Channels 4 + channels-redis, Celery + Beat, PostgreSQL 16 + PostGIS, Redis 7, MinIO (S3) locally, FCM for push. Exact libraries in ARCHITECTURE §4.
- **Brand** — name "Pepper" from config (`APP_NAME` env + `app/lib/core/config/brand.dart`). Colors, type and components exactly as ARCHITECTURE §15. Light + dark themes. Create an original chili-pepper SVG logo in the brand gradient and generate launcher icons + web favicon/manifest icons from it (flutter_launcher_icons, flutter_native_splash with black background).
- **Not Tinder** — copy patterns, never Tinder's name, flame, gradient, icons, sounds or copy. The match screen says "You matched!", not "It's a Match!".
- **Runs with zero credentials** — SMS = console provider (prints OTP to API logs), payments = fake provider, push = no-op when Firebase isn't configured, moderation = auto-approve, storage = MinIO. Real providers are implemented behind the same interfaces and switched by env vars.
- **Android emulator first** — default `API_BASE_URL` for Android debug is `http://10.0.2.2:8000`; allow cleartext HTTP **only in the debug** `network_security_config.xml`. Web/iOS-simulator default is `http://localhost:8000`. Configure CORS for the Flutter web dev server.
- **Bundle / application id** — `com.easytechsolutionz.pepper`.
- **Cross-platform dev scripts** — `Makefile` *and* `scripts/*.ps1` equivalents (I develop on a PC with VS Code + Android Studio).

## 2. Phases, deliverables and acceptance checks

### Phase 0 — Scaffold & tooling
- Monorepo exactly as ARCHITECTURE §5. `flutter create --org com.easytechsolutionz --project-name pepper --platforms=android,ios,web app`.
- `docker-compose.yml`: `db` (postgis/postgis:16), `redis`, `minio` (+ bucket auto-create job), `mailpit`, `api` (ASGI via daphne/uvicorn, hot reload), `worker` (celery), `beat`. Healthchecks on all. Volumes for data.
- `backend/config/settings/{base,dev,test,prod}.py` using django-environ; `.env.example` complete.
- Ruff + mypy config, pytest config, `very_good_analysis` for Flutter.
- GitHub Actions: `backend-ci.yml` (postgis + redis services, ruff, pytest), `app-ci.yml` (flutter analyze, flutter test, build apk debug).
- `GET /api/v1/healthz` and `/readyz` (checks DB + Redis).
- **Accept:** `docker compose up -d` → `curl localhost:8000/api/v1/readyz` returns `{"db":"ok","redis":"ok"}`; `flutter analyze` clean on the template; CI files valid YAML.

### Phase 1 — Accounts, profiles, media
- `core`: UUIDv7 base model, timestamps, cursor pagination, error envelope `{"error":{code,message,details}}` via custom exception handler, S2 cell helper (`s2sphere`, level 6), distance-label helper with rounding + stable per-pair jitter (§12).
- `accounts`: OTP request/verify with `phonenumbers` (+231 default), hashed codes, expiry, attempt & send limits; SimpleJWT with refresh rotation + blacklist; Google and Apple sign-in endpoints (verify ID tokens; skippable in dev); `Device` registration; `SmsProvider` interface (`console`, `twilio`, `africastalking`).
- `profiles`: Profile, Interest catalogue (seed ~60 interests incl. local ones: Afrobeats, Hipco, Football, Church, Palm butter cooking, Beach at Robertsport, Nollywood, Entrepreneurship…), DiscoveryPreference, Location (PostGIS geography + geo_cell), PassportLocation, counties with centroids (15 counties + diaspora), languages list, prompts catalogue, completeness computation, 18+ validation, sensitive-field handling (orientation/religion optional, hidden by default, encrypted at rest with `cryptography` Fernet key from env).
- `media`: presigned PUT upload URLs (≤10 MB, image MIME only), confirm endpoint, Celery task that downloads original → strips EXIF → re-encodes WebP `sm/md/lg` (320/720/1080) → computes blurhash → stores variants; reorder & delete; max 9 photos; `ModerationProvider` interface (`auto_approve`, `manual`).
- **Accept:** pytest covers OTP happy path, wrong code, expiry, rate limit; profile create/update; under-18 rejected; photo upload pipeline produces 3 variants without EXIF (test with a JPEG containing GPS EXIF); OpenAPI schema generates with no warnings.

### Phase 2 — Discovery, swipes, matches (the core loop)
- `discovery`: candidate SQL exactly per §8 (mutual gender + mutual age, radius via `ST_DWithin`, geo_cell pre-filter, blocks both ways, not swiped, not matched, active ≤30 days, ≥2 photos, discoverable, county filter, passport, global mode); Python scorer with weights in settings; diversification; Redis deck `deck:{user}` with TTL; async rebuild when < 10 left; card DTO per §7.2 (no coordinates).
- `swipes`: `POST /swipes` per §7.3 — idempotent insert, Redis mirrors, quota check via Redis with reset windows, **race-safe match creation** (ordered pair unique constraint + `select_for_update` or `INSERT … ON CONFLICT`), Super Like handling, `GET /swipes/quotas`, `POST /swipes/rewind` (entitlement-gated).
- `likes`: `GET /likes/received` — free tier gets count + **server-blurred** thumbnails (Pillow Gaussian blur variant generated on upload) and no ids; Gold+ gets full cards.
- `matches`: list with last message preview and unread count, unmatch.
- `seed_demo` management command (§18): 300 users across Liberian towns, generated abstract avatars (Pillow: gradient background + initials, multiple per user), interests, prompts, a known demo login (phone `+231770000001`, OTP printed in console; also accept fixed OTP `000000` **only when DEBUG**), and ~25 seeded users who already liked the demo user.
- **Accept:** tests prove: mutual-preference filtering both ways; blocked users never appear; already-swiped never reappear; two concurrent mutual likes → exactly one Match (use threads/transaction test); quotas enforce and reset; free user cannot see likers' ids; deck build for 300 seeded users < 300 ms locally.

### Phase 3 — Realtime chat & notifications
- `realtime`: Channels consumer at `/ws/` with JWT auth (query param or subprotocol), per-user group `user.<id>`, presence key with TTL, heartbeat, full event set from §9, typed envelope, error events, per-connection rate limit.
- `chat`: Message model with `client_id` idempotency, send via WS or REST, cursor history, read receipts (delivered to sender only if entitled), image messages via presigned upload, unmatch/block makes thread read-only and emits `match.removed`. Scam/spam heuristic on first 3 messages (§12) adding a `safety_warning` flag to the recipient's DTO.
- `GET /sync?since=` returning matches, messages, removals since timestamp.
- `notifications`: FCM provider (firebase-admin, enabled only if credentials file is set) + no-op provider; push on match, message (when recipient offline), Super Like received, likes milestones; per-user notification preferences; de-dup log.
- **Accept:** `WebsocketCommunicator` tests for auth reject, message send → both participants receive `message.new`, non-participant cannot send, typing relay, read receipt gating by entitlement, `match.created` on mutual like; push provider called when recipient offline (mocked).

### Phase 4 — Billing & premium features
- `billing`: Product/Purchase/Subscription/Wallet models; seed products for Plus/Gold/Platinum (1 week, 1 month, 6 months) and consumables (Super Like ×5, Boost ×1) with USD + LRD prices; `get_entitlements(user)` computed per §11 and cached; `PaymentProvider` interface with `fake`, `apple` (App Store Server API JWS verification), `google` (Play Developer API), `orange_money`, `mtn_momo` (initiate + webhook + signature verification; endpoints/credentials from env, clearly documented); webhooks; subscription expiry task in Beat.
- Premium features wired to entitlements: unlimited likes, Super Likes/day, Rewind, Passport, Boost (30 min, `boost_active` in scorer), Likes You unblur, Top Picks (daily 10, Beat job), read receipts, priority ranking.
- **Accept:** tests for each entitlement gate (free blocked with `402`/`FEATURE_LOCKED` code + paywall hint, paid allowed); fake purchase flow end-to-end; webhook idempotency; expiry task downgrades user.

### Phase 5 — Safety, moderation, account lifecycle, admin
- `safety`: Block (bidirectional everywhere), Report (from card, chat, match list; reporting a match also unmatches), underage report auto-pauses target, Verification (pose code → selfie upload → admin review → badge), ModerationAction audit log.
- Account: pause/resume (hidden from decks), data export (JSON download via signed URL), delete (soft now, Celery hard-delete after 30 days, immediate removal from all decks/matches).
- Django Admin: moderation queue views for pending photos, open reports (with quick actions: dismiss / remove photo / warn / ban), verification review side-by-side with profile photos; staff-only; list filters and search.
- Throttles on all write endpoints per §16.
- **Accept:** tests for block hides in deck/likes/matches/chat; report flow; delete removes user from other users' surfaces; admin actions create audit records.

### Phase 6 — Flutter foundation
- `core/config` (brand, env via `--dart-define`), `core/theme` (tokens + light/dark `ThemeData` per §15, Montserrat + Inter via bundled font files), `core/network` (Dio client with auth/refresh/error interceptors, `AppException`), `core/realtime` (`RealtimeService`: connect, heartbeat 25 s, backoff with jitter, resync via `/sync`, typed event stream), `core/storage` (secure storage on mobile, prefs on web), `core/router` (go_router with redirect guards and `StatefulShellRoute` for 5 tabs), shared widgets (gradient button, outline button, circular action button, chip, badge, avatar, shimmer/blurhash image, empty states, error view).
- Responsive shell: bottom tab bar on mobile; on width > 900 px a Tinder-web-style layout (left sidebar with matches/messages, centred 420×680 card).
- Android: permissions (location, camera, photos, notifications), debug-only cleartext config, adaptive icon. iOS: Info.plist purpose strings, Sign in with Apple capability placeholder. Web: manifest, icons, theme color `#E0102D`, PWA basics.
- **Accept:** `flutter analyze` zero issues; app launches on Android emulator and Chrome to splash → phone screen; theme golden tests (light/dark) pass.

### Phase 7 — Flutter features (full Tinder-style UX)
Build every screen in ARCHITECTURE §14 routing list, wired to the real API:
- **Auth**: phone entry with +231 flag picker, OTP 6-box input with auto-advance, resend timer; Google + Apple buttons (hidden when not configured).
- **Onboarding wizard** (progress bar, one question per screen): name, birthday (date wheel, 18+ check), gender, show me, relationship goal, photos grid (2–9, drag to reorder, crop, upload with progress via presigned URL), interests (max 5), languages, location permission with county-picker fallback, notifications permission.
- **Discover**: the swipe deck widget per §14 (pan/rotate physics, LIKE/NOPE/SUPER stamps, release thresholds, fling, spring-back, programmatic swipes from buttons, photo tap-zones + progress bars, expandable profile sheet, preloading), 5-button action bar with haptics, empty-deck state ("No one new around you" + adjust-distance CTA), out-of-likes paywall sheet with countdown, Super Like star border on cards that Super Liked you, Boost button with remaining-time ring, keyboard shortcuts on web.
- **Match celebration** screen (§15) with lottie/confetti, "Say hello" opens chat with keyboard focused.
- **Likes**: grid; blurred for free tier with count + upgrade CTA; tapping a card on Gold opens it with like/nope.
- **Chats**: horizontal "New matches" row (red ring for unopened), conversation list with preview, unread badge, timestamps; **thread** with bubbles per §15, day separators, typing indicator, read receipts (if entitled), image send, offline outbox with retry, safety warning banner, header menu (view profile, unmatch, block, report).
- **Profile**: own profile preview (as others see it), edit profile (photos, bio, prompts, interests, job, school, county, languages, height, goal, visibility of sensitive fields), verification flow (pose code → camera selfie → pending/verified states).
- **Settings**: discovery (distance slider 2–160 km, age range slider, show me, county filter, global mode, passport picker with diaspora cities and Liberian towns), notifications, data saver, theme, privacy, pause account, export data, delete account (with confirmation), logout, legal links.
- **Paywall**: tier comparison (Plus/Gold/Platinum) with durations and LRD/USD prices; on Android/iOS uses `in_app_purchase` → `/billing/verify`; on web uses mobile-money flow (choose Orange/MTN, enter number, "Approve on your phone" waiting state polling purchase status); fake provider in debug.
- **Explore**: themed deck tiles (stubs allowed to open filtered decks using `relationship_goal`/interest filters).
- **Accept:** widget tests for deck (drag past threshold → like callback; short drag → spring back; button → programmatic swipe), OTP input, paywall gating; golden tests for card, action bar, match screen, chat bubble (light + dark); `integration_test/app_flow_test.dart` (login as seeded demo user → swipe → match with a seeded liker → send message → receive echo from a test bot endpoint or second WS client).

### Phase 8 — Hardening, docs, release prep
- Performance: image cache sizing, deck preloading, list virtualization, `const` widgets, avoid rebuild storms; backend query counts asserted in tests for deck, matches list, messages list (no N+1).
- Accessibility: semantics labels on action buttons, minimum tap targets 48 dp, text scaling up to 1.3 without overflow.
- Error/empty/offline states everywhere; global offline banner.
- `docs/RUNBOOK.md`: Windows + macOS setup, Docker, Android emulator networking, running on a physical Android phone over LAN (`API_BASE_URL=http://<PC-LAN-IP>:8000`), Firebase setup (`google-services.json`, `GoogleService-Info.plist`, `FIREBASE_ENABLED`), switching SMS/payment providers, production deploy on a single VM with Caddy + managed Postgres, `flutter build appbundle`, `flutter build web`, iOS build via Codemagic/GitHub macOS runner.
- `docs/API.md`: generated endpoint list from OpenAPI + WebSocket event reference.
- `docs/STORE_COMPLIANCE.md`: checklist from ARCHITECTURE §19 with where each item is implemented (file paths).
- **Accept:** all backend tests green, coverage ≥ 80% on `services.py` modules; `flutter analyze` clean; `flutter test` green; `flutter build apk --debug` and `flutter build web` succeed; `PROGRESS.md` fully ticked.

## 3. Quality bar

- Production-grade code, not a demo: typed, validated, tested, documented.
- No secrets in code. No real people's images. No Tinder trademarks.
- No placeholder implementations in MVP flows (ARCHITECTURE §1 "MVP" rows). v1.1 items may be stubbed **only** if marked as such in `PROGRESS.md`.
- Consistent naming between backend DTOs and Dart models (snake_case JSON ↔ camelCase Dart via json_serializable `fieldRename`).
- Small, coherent commits per task if git is available (`feat(discovery): …`, `test(swipes): …`).

## 4. Final report (when everything is done)

Reply with:
1. What was built, per phase, with any deviations from `docs/ARCHITECTURE.md` and why.
2. Exact commands for me to run on my PC (Windows PowerShell and macOS/Linux) to: start the backend, seed data, run tests, launch the app on the Android emulator, launch on Chrome.
3. Demo credentials and a 2-minute manual test script (login → swipe → match → chat → buy Gold with fake provider → see Likes You unblurred).
4. Everything that needs real credentials before launch (SMS, Firebase, Apple/Google IAP, Orange Money, MTN MoMo, storage/CDN, Sentry) and where to put them.
5. Known limitations and the recommended next five tasks.
# Stack amendment (2026-11-15)

The product owner has explicitly superseded the original stack: React + TypeScript is the web app, Express + TypeScript is the API/WebSocket backend, PostgreSQL/PostGIS remains the database, Socket.IO/BullMQ replace Channels/Celery, and Flutter targets Android/iOS only. Interpret all phases and acceptance checks through those equivalents. This amendment overrides conflicting Django, DRF, Channels, Celery, Django Admin, and Flutter Web references above.

