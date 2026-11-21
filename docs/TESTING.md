# Testing Pepper locally

## Automated checks

On Windows PowerShell, run all repository checks from the project root:

```powershell
./scripts/test.ps1 all
```

Individual suites are available as `server`, `web`, or `app`. The combined command also runs the credential scan and fails immediately when any native tool exits unsuccessfully.

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

OTP requests are deliberately rate-limited. On a reused development database, wait for the 15-minute OTP window if the demo number has already reached its request limit.

## Manual clients

React web:

```powershell
cd web
npm run dev
```

Open `http://localhost:5173` and sign in with the demo phone and OTP above.

Android emulator:

```powershell
cd app
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000
```

Flutter unit and widget checks:

```powershell
cd app
flutter analyze
flutter test
```
