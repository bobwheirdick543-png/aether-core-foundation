# Phase S — Developer API Completion Record

**Status:** COMPLETE on `main` pending repository CI confirmation.

## Purpose

Phase S is Aether's external application boundary. It exposes a versioned `/api/v1/` surface without bypassing the platform's existing runtime, security, memory, knowledge, reporting, scheduling, module, or Battleversia boundaries.

## Architecture integration

`external app → /api/v1 → API-key authentication/scopes/rate limit → Phase O security boundary → existing Phase A durable runtime / Phase N orchestration / Phase M agent boundary / Phase Q module runtime → domain services → Phase K notifications and Phase W observability`.

Developer API keys are separate from AAX model credentials and separate from third-party provider credentials.

## Implemented

- Versioned `/api/v1/` gateway.
- Bearer API-key authentication using SHA-256 hashes; plaintext secrets are never persisted.
- Key creation, listing, immediate revocation and rotation.
- Per-key project binding, scopes, expiry and configurable per-minute rate limit.
- API request audit logs and key lifecycle events.
- Durable webhook registrations with one-time returned webhook secrets.
- Developer API dashboard and key workspace.
- Back navigation on new authenticated pages.
- Endpoint families for auth, projects, conversations, tasks, runs, agents, orchestration, memory, research, knowledge, reports, notifications, schedules, modules, Battleversia, webhooks and API logs.
- Ownership filtering for user-owned resources and server-side authorization at the API boundary.
- CORS preflight handling and request IDs.
- Focused Vitest coverage for key hashing and scope validation.
- TypeScript/build validation workflow.

## Security

API secrets are shown only at creation/rotation. Stored records contain a hash and display prefix. Revoked/expired credentials are rejected. Scope checks are enforced server-side. API activity is persisted without storing Authorization headers or plaintext credentials.

## Durability

The API layer is a boundary over existing persistent services. It does not keep task/run state in browser memory and does not create a second task queue. Task creation enters the Phase A durable Task → Run runtime; orchestration and agent execution remain governed by Phases N/M; modules remain governed by Phase Q; Battleversia remains governed by Phase R.

## Validation

The Phase S workflow runs Bun install, repository TypeScript checking, focused developer-API tests, and the production build. Vercel is intentionally not used for validation or deployment.
