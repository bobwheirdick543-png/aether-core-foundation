# Phase Q — Module Agent & Extensible Module System

Status: **COMPLETE on `main`**.

## Architecture integration

Phase Q extends the existing Aether architecture without creating a second task queue or authorization plane:

`request → authentication/permission → Phase O security decision → Phase A durable Task/Run runtime → Phase M bounded Module Agent → Phase Q versioned module registry → dependency/capability validation → trusted module handler → durable module run/artifact/event state → Phase K notifications / Phase W observability`

Phase N can orchestrate module work through the same Phase A Task/Run runtime. Phase P can observe module task-run telemetry without giving the Module Agent permission to self-modify production configuration. Phase O remains the authoritative security policy boundary.

## Durable module platform

- Versioned `modules` registry with owner, kind, status, manifest and configuration.
- Immutable-style `module_versions` lifecycle: draft → validated → tested → active, plus maintenance/disabled/rolled-back states.
- Dependency records with version ranges and cycle detection.
- Explicit module capability permissions derived from version manifests.
- Durable `module_runs` with idempotency, worker leases, heartbeats, bounded attempts, recovery and terminal states.
- Durable module artifacts, event ledger and configuration history.
- Server-only RPCs for atomic run claiming, lease recovery, completion and lifecycle transitions.
- RLS enabled with client mutations revoked; server functions re-check ownership/admin authority.

## Module Agent boundary

The Phase M Module Agent is enabled and seeded with bounded permissions for module creation, validation, testing, lifecycle management, execution and artifact handling. Role mutation and permission self-modification remain explicitly prohibited. Activation/lifecycle actions are additionally guarded by Phase O and administrator authorization.

## Trusted execution model

A module manifest never causes arbitrary source code or host filesystem code to execute. Runtime execution requires an explicitly registered server-side handler. Unknown handlers fail closed. Before execution, every declared capability is checked against the module version permission set and passed through Phase O security authorization.

## User surface

`src/routes/_authenticated/modules.tsx` provides the persistent modules workspace for creating drafts, inspecting versions and durable runs, and invoking lifecycle actions. Browser state is presentation only; Supabase is the source of truth.

## Validation

Phase Q validation workflow:

- Bun install: success
- Focused TypeScript: success
- Module runtime Vitest suite: success
- Production build: success

Successful validation run: **34634437178**, job **103378791659**.

Production Supabase project `hpxisijyglkdlcpqjtpd` has the Phase Q module schema, lifecycle RPCs, worker RPCs, Module Agent permissions and capability-permission synchronization applied. A database smoke test successfully created and validated a temporary module version and removed it afterward.

Vercel was intentionally not used for Phase Q validation or deployment.
