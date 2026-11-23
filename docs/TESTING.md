# Testing Pepper locally

## Automated checks

On Windows PowerShell, run all repository checks from the project root:

```powershell
./scripts/test.ps1 all
```

Individual suites are available as `server`, `web`, or `app`. The combined
command also runs the credential scan and fails immediately when any native
tool exits unsuccessfully. The app target includes a debug APK build, so it is
slower than the analysis and widget tests alone.

The acceptance commands enforce non-regression coverage floors:

| Area | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Express server | 33% | 15% | 18% | 53% |
| React web | 70% | 60% | 60% | 90% |
| Flutter mobile | — | — | — | 17% |

These floors prevent coverage from silently declining; they are not a claim
that every risk is comprehensively tested. New and changed business logic still
requires focused happy, authorization, permission, and validation coverage.

## Complete local product smoke test

Start, migrate, and seed the development stack when needed:

```powershell
./scripts/dev.ps1 up
./scripts/dev.ps1 migrate
./scripts/dev.ps1 seed
```

Then run:

```powershell
cd server
npm run product:smoke
```

The smoke workflow uses the seeded `+231770000001` demo account and development OTP `000000`. It verifies real HTTP calls for authentication, the existing profile, discovery preferences, the discovery deck, likes, matches, chat persistence, products, fake purchase verification, and returned entitlements. It may create a match, adds a timestamped development chat message, and uses a deterministic fake receipt so repeated purchase verification is idempotent.

For the complete realtime acceptance across the isolated server protocol, the
production React realtime client, and the production Flutter realtime service:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/realtime-e2e.ps1
```

The stack must be running, migrated, and seeded, and the demo account must have
an active match (the product smoke workflow creates one when possible). The
server portion creates and cleans up isolated users; the client portions use a
short-lived development session. If OTP throttling is active, pass a current
development token with `-AccessToken`.

OTP requests are deliberately rate-limited. On a reused development database, wait for the 15-minute OTP window if the demo number has already reached its request limit.

## Manual clients

React web:

```powershell
cd web
npm run dev
```

Open `http://localhost:5173` and sign in with the demo phone and OTP above.

For the manual web acceptance pass, test at 320 px, 390 px, 768 px, and desktop widths. Complete every primary route using only the keyboard; confirm the skip link, visible focus, dialogs, retry alerts, reduced-motion preference, and mobile bottom navigation. Repeat discovery and Likes with browser data-saving or network throttling enabled to verify responsive/lazy images and recoverable offline states.

Android emulator:

```powershell
cd app
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
```

Flutter unit and widget checks:

```powershell
cd app
flutter analyze
flutter test --coverage
node ../scripts/flutter-coverage-budget.mjs
```

## Performance budgets

The web production build is limited to 400 KiB of uncompressed JavaScript and
25 KiB of uncompressed CSS. The Android development APK is limited to 150 MiB;
this is a CI artifact-regression guard, not an estimate of the optimized store
download. CI checks these limits after each build. Run the same checks locally:

```powershell
cd web
npm run build
npm run budget

cd ..\app
flutter build apk --debug --target-platform android-x64
cd ..
node scripts/performance-budget.mjs app
```

Flutter profile photos are decoded near their rendered dimensions (with an
upper bound) to avoid retaining source-resolution images in memory. The swipe
deck and image fades also honor the platform reduced-motion setting.
