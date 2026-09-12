# Aether Developer API v1

Base path: `/api/v1/`

Authentication: `Authorization: Bearer aether_sk_...`

API keys are created from the authenticated Aether Developer API workspace. Store the returned secret securely; Aether stores only its hash and prefix.

## Endpoints

- `GET /v1/auth` — validate the credential and inspect its scopes.
- `GET /v1/projects`, `GET/DELETE /v1/projects/{id}`, `POST /v1/projects` — project access.
- `GET /v1/conversations`, `GET /v1/conversations/{id}` — conversation access.
- `GET/POST /v1/tasks`, `GET /v1/tasks/{id}` — durable Task/Run entry point.
- `GET /v1/runs/{id}` — run state plus persisted task events.
- `GET /v1/agents` — registered agent catalogue.
- `GET /v1/orchestration` — owned orchestration plans.
- `GET /v1/memory` — owned memory candidates.
- `GET /v1/research` — owned research sessions.
- `GET /v1/knowledge` — owned knowledge entries.
- `GET /v1/reports` — owned report metadata.
- `GET /v1/notifications` — owned notifications.
- `GET/POST /v1/schedules` — durable schedules.
- `GET /v1/modules` — registered modules.
- `GET /v1/battleversia` and realm paths such as `/v1/battleversia/auctions` — Battleversia data boundary.
- `GET/POST /v1/webhooks` — durable webhook registrations.
- `GET /v1/logs` — owned API audit activity.

## Durable task example

```http
POST /api/v1/tasks
Authorization: Bearer aether_sk_...
Content-Type: application/json
Idempotency-Key: task-client-123

{"title":"Run my Aether task","kind":"general","detail":{"input":"hello"}}
```

The API hands work to the existing Phase A durable Task → Run runtime. It does not create a competing queue, and work can continue independently of the browser.

## Security model

API-key authentication and scopes are checked before domain handling. Developer API requests also pass through Phase O security policy authorization. Ownership is checked server-side. Sensitive credentials and provider secrets are never returned by the API.

## Errors

Errors use JSON with `error.code`, `error.message`, and optional `error.details`. Common responses include `401 invalid_api_key`, `403 insufficient_scope`, `403 security_denied`, `202 approval_required`, `404 not_found`, `415 unsupported_media_type`, `429` rate limiting, and `500 internal_error`.

## Idempotency and request tracing

Send `X-Request-Id` to correlate a request across API/security/audit records. Task creation also accepts `idempotencyKey` in its JSON payload and delegates idempotent work to the durable runtime.

## SDK

The repository includes a small provider-independent TypeScript client helper under `src/lib/aether/developer-api-client.ts`. It uses standard `fetch`, so applications can wrap it for their preferred runtime without coupling Aether to a vendor SDK.
