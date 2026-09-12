# Phase S — Developer API Completion Record

**Status:** COMPLETE and validated on `main`.

## Purpose

Phase S is Aether's external application boundary. It exposes a versioned `/api/v1/` surface without bypassing the platform's existing runtime, security, memory, knowledge, reporting, scheduling, module, or Battleversia boundaries.

## Architecture integration

`external app → /api/v1 → API-key authentication/scopes/rate limit → Phase O security decision → existing Phase A durable runtime / Phase N orchestration / Phase M bounded agents / Phase Q module runtime → domain services → Phase K notifications and Phase W observability`.

Developer API keys are separate from AAX model credentials and separate from third-party provider credentials.

## Implemented

- Versioned `/api/v1/` REST/JSON gateway.
- Bearer API-key authentication using SHA-256 hashes; plaintext secrets are never persisted.
- Key creation, listing, immediate revocation and rotation.
- Per-key project binding, scopes, expiry and configurable per-minute rate limit.
- Durable API request audit logs and key lifecycle events.
- Durable webhook registrations with one-time returned webhook secrets.
- Developer API dashboard and key workspace.
- Back navigation on new authenticated pages.
- Endpoint families for auth, projects, conversations, tasks, runs, agents, orchestration, memory, research, knowledge, reports, notifications, schedules, modules, Battleversia, webhooks and API logs.
- Ownership filtering for user-owned resources and server-side authorization at the API boundary.
- Phase O policy authorization before domain handling.
- CORS preflight handling and request IDs.
- Structured JSON error responses and rate-limit responses.
- Provider-independent TypeScript client helper and human-readable API reference/examples.
- Focused Vitest coverage for key hashing and scope validation.
- TypeScript/build validation workflow.

## Security

API secrets are shown only at creation/rotation. Stored records contain a hash and display prefix. Revoked/expired credentials are rejected. Scope checks are enforced server-side. API activity is persisted without storing Authorization headers or plaintext credentials. High-impact mutation classes can be held for approval by the Phase O governance layer.

## Durability

The API layer is a boundary over existing persistent services. It does not keep task/run state in browser memory and does not create a second task queue. Task creation enters the Phase A durable Task → Run runtime; orchestration and agent execution remain governed by Phases N/M; modules remain governed by Phase Q; Battleversia remains governed by Phase R.

## Production security smoke test

A real Phase O authorization call for a Developer API task-read action returned `allow`, confirming the Developer API security action is recognized by the production security policy layer. The smoke request used an idempotency key and was recorded by the security/audit subsystem.

## Validation

Final SDK-integrated Phase S validation ran on commit `b04a0132a787f168e9724ac337e9e1854864c8b1`: Bun install, focused Phase S TypeScript, focused Phase S Vitest, and `bun run build:dev` all completed successfully. The validation run was `34678753605` / job `103513267858`. Vercel was intentionally not used for validation or deployment.
