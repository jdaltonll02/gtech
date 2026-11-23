# Pepper mobile

Flutter Android and iOS clients for Pepper.

## Live realtime acceptance

The opt-in test in `test/live/realtime_live_test.dart` exercises the
production `ApiClient` and `RealtimeService` against a running Pepper stack. It
is intentionally excluded from ordinary `flutter test` runs because it writes
a uniquely identified message to a real development match.

Start, migrate, and seed the root Docker stack. The default harness signs in as
the seeded demo user with the development-only OTP and uses its first active
match:

```powershell
flutter test test/live/realtime_live_test.dart `
  --dart-define=RUN_LIVE_REALTIME_TEST=true `
  --dart-define=API_BASE_URL=http://localhost:8000
```

`E2E_PHONE`, `E2E_OTP`, `E2E_ACCESS_TOKEN`, and `E2E_MATCH_ID` can override the
defaults. Supplying the token and match ID avoids an OTP request and is useful
when another smoke-test process has already prepared two participants.

The test verifies the raw Socket.IO connection used by the mobile client,
authenticated initial resync, realtime send/receive, and HTTP reconciliation.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
