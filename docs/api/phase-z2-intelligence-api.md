# Phase Z2 — Aether Intelligence API

Phase Z2 is the external intelligence boundary for Aether Ascension (AAX). Independent applications such as WhatsApp bots, Telegram bots, websites, games, mobile apps and SaaS products consume AAX intelligence with an Aether API key. They do not become Aether sessions and never receive Aether's internal provider credentials.

## API key lifecycle

Z2 keys are generated as `AAX-<generation>.<revision>-<64-character-secret>`. The secret is cryptographically generated and never reused. AAX keys are model-locked at creation time: the creator selects one currently available Ascension model, such as Ascension 1.0, 2.0 or 3.1. The model registry remains authoritative for availability and release state.

Each key has a persistent nickname, application name, environment (`development`, `test`, or `production`), status, expiration, model identity, token allocation, rate limit, last-used timestamp and lifecycle history. Free accounts have five active Z2 keys and 200,000 monthly tokens per key. Administrator-created keys are not subject to the ordinary key-count limit and may use a custom token allocation or an unlimited allocation.

The complete key can be recovered and copied from the authenticated platform UI for new Z2 credentials. Secrets are encrypted at rest with the server-only `AETHER_API_KEY_ENCRYPTION_KEY`; legacy pre-Z2 keys that were stored only as hashes must be rotated before recovery is possible.

Revoked, suspended and expired credentials are rejected before AAX execution. Unlimited token allocation does not bypass authentication, authorization, rate, request, concurrency or infrastructure controls.

## Intelligence endpoint

`POST /api/v1/intelligence`

Authentication:

`Authorization: Bearer AAX-3.1-<64-character-secret>`

Example request:

```json
{
  "messages": [
    {"role": "user", "content": "Explain quantum physics simply."}
  ]
}
```

The selected model is taken from the API credential. A caller may optionally include `model`; if it differs from the credential's locked model, the request is rejected.

Optional fields include `webResearch`, `maxOutputTokens`, `temperature`, `responseFormat` (`text` or `json`) and a future-compatible `stream` flag. Web research is permitted only when enabled for the credential and only when the underlying Aether research/runtime capability is available.

## Quota and request accounting

Z2 reserves a bounded estimate before execution and finalizes against actual provider usage. Accounting is atomic at the database layer so concurrent requests cannot race beyond the monthly allocation. Per-request token ceilings, input limits, output limits, rate limits and concurrency controls remain separate from the monthly allocation.

When a quota is exhausted the API returns a controlled error with code `monthly_token_quota_exhausted` or the applicable quota error. It never executes the model after quota rejection.

## Audit and response records

Every authenticated intelligence request receives a stable Request ID and a durable request record. The record tracks application, environment, key, model, provider, provider model, request body, response, response-validation status, token usage, latency, outcome and error information. API summary logs are also written for every call, including rejected/failed calls where no authenticated key is available.

Credential lifecycle actions are recorded as key events. Administrative actions are additionally recorded through the platform audit system.

Request records are retained as permanent lifecycle-class records until an authorized lifecycle process changes their state. Retention/deletion must follow the existing Phase Y lifecycle and Safety Bin boundaries.

## Security boundary

Z2 credentials authorize AAX intelligence only. They are not master credentials for Aether OS data, private conversations, private memory, Safety Bin contents, administrator controls, internal agents or provider secrets. Aether's provider API keys remain server-side.

## Reliability

Normal requests target approximately four seconds where feasible. Research, tool calls, long-context execution and provider recovery can take longer. Phase W observability records actual latency, success rate, provider behavior and fallback/recovery information; the API does not fabricate performance metrics.

## Server configuration

Set the server-only environment variable `AETHER_API_KEY_ENCRYPTION_KEY` to a 32-byte key encoded as 64 hexadecimal characters or base64url. Never expose this value to client-side code.
