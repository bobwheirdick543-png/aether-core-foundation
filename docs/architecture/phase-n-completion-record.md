# Phase N — Orchestrator Agent Completion Record

Status: implementation and validation target for `main`.

Phase N integrates the Phase B cognitive orchestration boundary with the Phase M Agent SDK/runtime and Phase A durable task foundation. It adds durable orchestration plans, dependency-aware steps, approval/verification/policy gates, atomic step claims, result aggregation, idempotency and lease recovery.

## Architecture integration

`request → auth/permission → durable task (A) → orchestrator plan (N) → bounded registered agent (M) → agent handoff/message → step result/gate → aggregation → durable task completion → notifications/reports/telemetry`

The Orchestrator does not become a second task queue. It stores orchestration state and delegates execution through the existing durable runtime. Agents remain bounded by their registered permissions and cannot select themselves as workers.

## Durability and safety

- Plans and steps persist in Supabase.
- Plan creation is idempotent.
- Dependency readiness is checked server-side.
- Step claims are locked atomically and receive a lease.
- Expired leases are recoverable within the step retry budget.
- Critical step failure fails the plan; successful completion aggregates step results.
- Approval/verification/policy gates are durable records.
- Ownership is checked server-side; admin access is explicit.
- Agent execution authorization is delegated to the Phase M permission boundary.
- No browser state is the source of truth.
- No provider-specific model dependency is introduced.

## Validation

The Phase N workflow must pass focused TypeScript, orchestration unit tests and the production build. Supabase migration review is part of the phase gate. Vercel deployment is intentionally not used for validation.
