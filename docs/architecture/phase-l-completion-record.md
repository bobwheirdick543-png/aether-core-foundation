# Phase L — Scheduling & Background Automation

Status: **COMPLETE**

Phase L integrates the authoritative post-Part-2 architecture as:

`User/Web/API → Auth/Permission → Durable Scheduler → Scheduled Run Queue → Phase A Runtime/Workers → Notifications/History`

## Delivered

- Database-backed schedule definitions; browser state is never the source of truth.
- One-time, interval and five-field cron schedules with timezone-aware advancement.
- Durable scheduled-run history with immutable identity, idempotency keys, attempt counts, leases and results/errors.
- Atomic `FOR UPDATE SKIP LOCKED` schedule/run claiming for concurrent workers.
- Worker leases with bounded lease duration so crashed scheduler workers can be detected.
- Expired scheduler-lease recovery with bounded attempts and terminal failure state.
- Atomic scheduler → Phase A runtime handoff: queued scheduled runs create durable `tasks` and `task_runs` records using idempotency keys.
- Terminal Phase A task-run status is reflected back into `scheduled_runs` through a database trigger, so browser closure or worker restart cannot lose completion state.
- Pause/resume/edit/delete operations restricted to the schedule owner.
- Durable run-now operation and owner-scoped run history.
- Worker claim/recovery operations restricted to administrator/server-worker contexts.
- RLS for schedule ownership and no client access to scheduled-run mutation state.
- Deterministic cron validation, timezone validation, next-run calculation, retry/idempotency primitives and bounded worker tick behavior.
- Persistent schedule workspace at `/schedules`.
- Browser-independent scheduler worker contract in `scheduler-worker.ts`.
- Focused regression tests and Phase L CI validation.

## Architecture relationship

Phase L does **not** create a competing task engine. It is the durable time/event boundary that creates work for the existing Aether Phase A runtime. A schedule firing creates a `scheduled_runs` record; the scheduler worker atomically creates the common `tasks`/`task_runs` records; existing Phase A workers claim and execute those runs under the platform quotas, leases, retries, cancellation, timeout and dead-letter rules. Phase K remains the notification/delivery boundary for durable completion/failure events. Phase L never performs business logic in a browser.

## Recovery model

A scheduler worker crash leaves its handoff lease in `running`. The recovery RPC detects expired scheduler leases and requeues the scheduled run until `max_attempts` is reached, after which the run becomes terminal `failed`. Phase A independently owns runtime execution leases and retries. Idempotency keys prevent duplicate schedule firings and duplicate runtime task/run creation when a worker restarts.

## Security

Schedule ownership is enforced server-side and by database RLS. Worker operations are privileged and are not exposed through direct client scheduled-run mutation. Schedule payloads are persisted as data and do not grant permissions. Task execution remains bounded by the Phase A runtime and agent policy layer.

## Supabase deployment verification

The production Supabase project contains the Phase L durable scheduling/runtime bridge and cron hardening migrations. The database was verified with zero existing schedules/runs before the scheduler claim, dispatch and recovery smoke calls; all returned without errors and recovery reported zero abandoned runs.

## Validation

Final Phase L validation passed on **2026-09-11**:

- GitHub Actions run: `34609828606`
- Phase L job: `103297232882`
- TypeScript validation: passed
- Phase L scheduler regression tests: **8 passed**
- Production build: passed
- Final main commit at validation: `9ae96cc42cf670ac5f3894d944d12062be4a0c7d`

Vercel was not used for Phase L implementation or validation.
