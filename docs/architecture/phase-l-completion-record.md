# Phase L — Scheduling & Background Automation

Status: **COMPLETE**

Phase L integrates the authoritative post-Part-2 architecture as:

`Scheduler → Durable scheduled run queue → Worker lease → Runtime/task execution → Notifications/history`

## Delivered

- Database-backed schedule definitions; browser state is never the source of truth.
- One-time, interval and five-field cron schedules with timezone-aware cron advancement.
- Durable scheduled run history with immutable identity, idempotency keys, attempt counts and results/errors.
- Atomic `FOR UPDATE SKIP LOCKED` schedule/run claiming for concurrent workers.
- Worker leases with bounded lease duration so crashed workers can be detected.
- Expired-lease recovery with bounded attempts and terminal failure state.
- Pause/resume/edit/delete operations restricted to the schedule owner.
- Worker claim/recovery operations restricted to administrators/server worker contexts.
- RLS for schedule ownership and no client access to scheduled-run mutation state.
- Deterministic retry/idempotency primitives in the application layer.
- Persistent schedule workspace at `/schedules`.
- Focused regression tests and Phase L CI validation.

## Architecture relationship

Phase L does not create a competing task engine. It is the durable time/event boundary that creates work for the existing Aether runtime. A schedule firing creates a `scheduled_runs` record; workers claim it with a lease, execute through the common runtime/task layer, and record completion. Phase K remains the notification/delivery boundary for durable completion/failure events. Phase L never performs business logic in a browser.

## Recovery model

A worker crash leaves a leased run in `running`. The recovery RPC detects expired leases and requeues the run until `max_attempts` is reached, after which the run becomes terminal `failed`. Idempotency prevents duplicate schedule firings for the same scheduled timestamp.

## Security

Schedule ownership is enforced server-side and by database RLS. Worker operations are privileged and are not exposed through direct client table mutation. Schedule payloads are persisted as data and do not grant permissions. Task execution remains bounded by the runtime/agent policy layer.

## Validation

Phase L validation covers schedule validation, cron contract shape, deterministic idempotency keys, bounded retry behavior, focused TypeScript checking, regression tests and the production build. Vercel is not used for validation or deployment.
