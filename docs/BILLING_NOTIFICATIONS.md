# Store billing notifications

Pepper exposes separate, throttled notification endpoints for the two mobile stores:

- `POST /api/v1/billing/webhooks/apple` for App Store Server Notifications V2.
- `POST /api/v1/billing/webhooks/google` for Google Play real-time developer notifications delivered by Pub/Sub.

The generic `/api/v1/billing/webhooks/:provider` contract is only for the fake development provider and mobile-money HMAC integrations. It intentionally rejects Apple and Google payloads.

## Apple setup

Set `APPLE_BUNDLE_ID`, `APPLE_ENVIRONMENT`, `APPLE_ROOT_CA_FILES`, and, in production, `APPLE_APP_ID`. Configure the HTTPS Apple notification URL to use the Apple endpoint above and select notifications version 2.

Pepper verifies the outer `signedPayload` and the nested signed transaction and renewal information with Apple's App Store Server Library. The stable original transaction identifier links renewals to the purchase already claimed by a Pepper account. Apple documents the signed V2 flow in [Receiving App Store Server Notifications](https://developer.apple.com/documentation/appstoreservernotifications/receiving-app-store-server-notifications).

## Google setup

Set `GOOGLE_PACKAGE_NAME`, `GOOGLE_SERVICE_ACCOUNT_FILE`, `GOOGLE_PUBSUB_AUDIENCE`, and `GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL`. Configure an authenticated Pub/Sub push subscription whose audience and user-managed service account exactly match those values.

Pepper verifies the Google-signed OIDC token, audience, verified email claim, and service-account email. It then validates the decoded package name and queries the Google Play Developer API for current purchase state instead of trusting the Pub/Sub data alone. See Google's [authenticated push guidance](https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions) and [RTDN reference](https://developer.android.com/google/play/billing/rtdn-reference).

## Processing guarantees

- Apple `notificationUUID` and Google Pub/Sub `messageId` are stored as provider event identifiers, making repeated deliveries idempotent.
- Refunds revoke the associated subscription immediately. Expiry notifications end it without rewriting the historical purchase as a refund.
- Only purchase and renewal events grant product wallet benefits; unrelated lifecycle notifications can update subscription state without granting duplicate benefits.
- Missing credentials fail with `503`; invalid signatures or identities fail with `401`; invalid envelopes fail with `400`. A successful or already-processed event returns `200`.

Provider credentials and root certificates must be mounted at deployment time and must never be committed.
