# Pepper API and realtime reference

The Express API is versioned under `/api/v1`. The executable OpenAPI 3.1
document is defined in `server/src/core/openapi.ts` and served at:

```text
GET /api/v1/schema
```

Treat that JSON and the route Zod schemas as the machine-readable contract.
This document explains integration conventions and realtime behavior.

## Conventions

- JSON request and response fields use `snake_case`.
- Times are ISO-8601 UTC strings.
- IDs are UUIDs (normally UUIDv7).
- Authenticated HTTP requests use `Authorization: Bearer <access-token>`.
- Access tokens are short-lived. Refresh tokens are rotated with
  `POST /auth/refresh` and revoked with `POST /auth/logout`.
- Cursor collections return `results` and `next_cursor`.
- Unknown fields are rejected on strict write schemas.
- Exact user coordinates are never returned. Discovery returns a rounded
  server-computed distance label.

Errors have one stable envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {}
  }
}
```

Clients should branch on `error.code`, display the safe `message`, and treat
`details` as optional diagnostic/field information. A `401` should trigger at
most one refresh-and-retry attempt. Respect `429` responses and do not loop.

## Authentication example

Request a challenge:

```http
POST /api/v1/auth/otp/request
Content-Type: application/json

{"phone":"+231770000001"}
```

Verify the six-digit code:

```http
POST /api/v1/auth/otp/verify
Content-Type: application/json

{"challenge_id":"<uuid>","code":"000000"}
```

`000000` is accepted only by the development flow. Production clients must use
the configured SMS provider. Persist mobile tokens in platform secure storage;
the web client stores the refresh token locally and keeps the access token in
application state/storage according to `web/src/core/storage.ts`.

## HTTP surface

The table is an index; consult `/api/v1/schema` for per-operation status codes.

| Area | Methods and paths |
|---|---|
| Operations | `GET /healthz`, `GET /readyz`, `GET /schema` |
| Auth | `POST /auth/otp/request`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/auth/social/{provider}` |
| Devices | `POST /auth/devices`, `DELETE /auth/devices/{id}` |
| Profile | `GET/PATCH /profiles/me`, `POST /profiles/me/complete` |
| Preferences | `GET/PATCH /profiles/me/preferences`, `PUT /profiles/me/location`, `PUT/DELETE /profiles/me/passport` |
| Catalogues | `GET /meta/interests`, `/meta/counties`, `/meta/languages`, `/meta/prompts` |
| Profile media | `POST /media/photos/upload-url`, `POST /media/photos`, `PATCH /media/photos/reorder`, `DELETE /media/photos/{id}` |
| Discovery | `GET /discovery/deck`, `GET /discovery/top-picks` |
| Swipes | `POST /swipes`, `GET /swipes/quotas`, `POST /swipes/rewind` |
| Likes and matches | `GET /likes/received`, `GET /matches`, `DELETE /matches/{id}` |
| Chat | `GET/POST /matches/{id}/messages`, `POST /matches/{id}/read`, `POST /chat/upload-url`, `GET /sync` |
| Notifications | `GET/PATCH /notifications/preferences` |
| Billing | `GET /billing/products`, `GET /billing/entitlements`, `POST /billing/verify`, `POST /billing/mobile-money/initiate`, `GET /billing/purchases/{id}`, `POST /billing/boost/activate` |
| Provider callbacks | `POST /billing/webhooks/apple`, `/billing/webhooks/google`, `/billing/webhooks/{provider}` |
| Safety | `POST /safety/blocks`, `DELETE /safety/blocks/{userId}`, `POST /safety/reports`, `POST /safety/verification/start`, `POST /safety/verification/submit` |
| Moderation | `GET /admin/moderation/queue`, review/remove operations under `/admin/moderation/*` (staff only) |
| Account lifecycle | `POST /account/pause`, `POST /account/resume`, `GET /account/export`, `DELETE /account` |

All paths in this table are relative to `/api/v1`.

## Direct media upload

Profile and chat images use signed direct uploads:

1. Request an upload URL with MIME type and byte length.
2. Upload the exact bytes to `upload_url` using the returned
   `required_headers` before expiry.
3. Confirm the profile photo or send the chat message using the returned key.

Accepted image types are JPEG, PNG, and WebP, with a 10 MiB maximum. Profile
photos are downloaded by the worker, metadata is stripped, and variants are
re-encoded before use. Never infer public object URLs from storage keys.

## Idempotency and synchronization

- A chat send includes a client-generated UUID `client_id`; retry the same
  value after uncertain delivery.
- Swipe and payment flows preserve idempotency in their service/repository
  layers. Never generate a new provider event ID while retrying the same event.
- After a socket reconnect, call `GET /sync?since=<ISO timestamp>`. The timestamp
  must not be in the future and must be within 30 days.

## Realtime connection

Pepper uses Socket.IO on path `/ws/`, with WebSocket preferred and polling
fallback. Supply the access token in the Socket.IO `auth.token` field. Query or
subprotocol token support exists for compatibility, but clients should prefer
the auth field to avoid tokens in URLs and proxy logs.

```ts
const socket = io(apiOrigin, {
  path: '/ws/',
  transports: ['websocket'],
  auth: {token: accessToken},
});
```

Server envelopes have this shape:

```json
{
  "type": "message.new",
  "id": "019...",
  "ts": "2026-11-21T12:00:00.000Z",
  "data": {}
}
```

Listen to `event` for every envelope. The server also emits the specific type
name for feature-scoped listeners.

### Client-to-server events

| Type | Data | Result |
|---|---|---|
| `ping` | `{}` | `pong`; renews the 60-second presence lease |
| `message.send` | `{match_id, client_id, kind, body?, media_key?}` | `message.send.ack` |
| `message.read` | `{match_id, up_to_message_id}` | `message.read.ack` |
| `typing` | `{match_id, is_typing}` | `typing.ack` |

Clients may emit the named event directly or emit `event` with
`{type, data}`. No more than 60 client events per socket per minute are
accepted.

### Server-to-client events

| Type | Meaning |
|---|---|
| `match.new` | A mutual connection was created |
| `match.removed` | A match was removed by unmatch, block, or account action |
| `message.new` | A message was accepted or delivered |
| `message.read` | A qualifying read receipt changed |
| `typing` | The other participant changed typing state |
| `pong` | Heartbeat acknowledgement |
| `error` | Safe failure envelope with `code`, `message`, and `details` |

Reconnect with exponential backoff and jitter, refresh authentication before
reconnecting after an auth failure, then run HTTP synchronization. Do not rely
on presence as durable state.

## Account and privacy behavior

- Pause immediately hides the account from discovery without deleting data.
- Export writes a JSON snapshot to private object storage and returns a signed
  download URL valid for 15 minutes.
- Delete requires `{"confirmation":"DELETE"}`, hides the account, revokes
  tokens, removes matches, and schedules hard deletion after 30 days.
- The hourly worker deletes due account records and associated object keys.

## Webhooks

Webhook endpoints are unauthenticated by user JWT because the provider is the
caller. They fail closed using provider signatures/JWS/identity tokens and use
provider event identifiers for replay protection. Return success only after the
event is durably and idempotently applied. Never expose webhook secrets to a
client or log raw receipts/tokens.

## Contract change procedure

For each new endpoint, update the Zod request schema, authorization and
throttle, `server/src/core/openapi.ts`, happy/auth/permission/validation tests,
and this index if a new area is introduced. Breaking changes require a new API
version; additive fields must remain safe for older clients.
