# Phase A Completion Record — Durable Runtime

**Status:** Implemented in `main`  
**Merge commit:** `a3125180821aacbf86d63065d286196ce68992ba`  
**Validation:** Phase A Durable Runtime Validation run `34684787397` — success

## Scope completed

Phase A establishes the durable execution boundary required by the Aether architecture:

`Interfaces / API → Auth + Permissions → Cognitive Orchestrator → Durable Task/Run Runtime → Worker → Authorized Domain Executor / AAX Capability`

Completed capabilities:

- PostgreSQL-backed durable task/run queue.
- Transactional worker claiming with leases.
- Worker identity, heartbeat and lifecycle state.
- Deadline and cancellation-aware execution.
- Platform/user/project runtime quotas.
- Ordered task/run event history.
- Worker crash recovery through expired-lease reconciliation.
- Immutable retry attempts linked with `retry_of`.
- Durable retry scheduling with retry budget and backoff.
- Terminal dead-letter handling when retry/timeout budgets are exhausted.
- Idempotency protection for duplicate task/run submission.
- Persistent long-running worker daemon at `scripts/aether-runtime-worker.ts`.
- Graceful worker draining and offline state.
- Explicit failure for unsupported task kinds; no fabricated success.
- Worker entrypoint validation and production build validation.

## Operational boundary

The worker is a server-side long-running process and is intentionally separate from the web request lifecycle. It requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in its worker environment. The service-role secret never enters client-side code or public routes.

The repository now contains the worker implementation and its validation. A production deployment must run this worker as a persistent process in the selected worker environment; the browser and web request process are not used as a daemon.

## Validation record

The dedicated Phase A workflow validates:

1. Worker entrypoint configuration parsing.
2. Existing Phase A runtime unit tests.
3. Production application build.

The main-branch Phase A workflow completed successfully for merge commit `a3125180821aacbf86d63065d286196ce68992ba`.

## Non-goals

Phase A does not claim completion of later domain phases. It provides the durable execution substrate those phases use. Domain-specific executors are registered independently and must report real results; unsupported work fails explicitly until its executor exists.
