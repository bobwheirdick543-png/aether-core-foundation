# Aether Runtime Architecture (Foundation)

This document describes the **real** modular foundation implemented under `src/lib/aether`.

No external AI provider is required. No fabricated agent activity or analytics.

## Layers

```
User / Admin request
        ↓
Server functions (auth + ownership)
        ↓
Cognitive Orchestrator (planWorkflow / decideNext)
        ↓
Task / Run engine (state machine)
        ↓
Agent boundary checks (security.ts)
        ↓
Controlled Executor (research retrieval today)
        ↓
Native Research Engine (fetch + extract)
        ↓
Knowledge pipeline / Report builder / Notifications
        ↓
Audit log + optional Optimization scan
```

## Key modules

| Module | Role |
|--------|------|
| `agents.ts` | Static agent workforce definitions + least-privilege permissions |
| `agent-sdk.ts` | Input/output contracts, policies, messaging |
| `task-runtime.ts` | Task vs Run, state machine, ownership helpers |
| `task-service.ts` | Create task/run, transition status |
| `task.functions.ts` | Authenticated create/list/get |
| `task-control.functions.ts` | Cancel + Retry |
| `executor.ts` | Controlled single-step research execution |
| `research-engine.ts` | Native URL retrieval + metadata extraction |
| `orchestrator.ts` | Workflow planning |
| `approvals.ts` | Approve / reject / retry contracts |
| `knowledge-pipeline.ts` | Acquisition → production stages |
| `knowledge.functions.ts` | Admin approve/reject with versioning |
| `pdf-report.ts` + `report-builder.ts` | Report metadata + structured content |
| `notifications.ts` + hooks | Ownership-safe delivery |
| `security.ts` | Boundary enforcement |
| `optimization.ts` | Recommendations only (never auto-apply) |
| `evaluation.ts` | Metrics from real runs only |
| `governance.ts` | What requires admin approval |
| `scheduler.ts` | Schedule definitions + next-fire |
| `agent-registry.ts` | Sync static agents into DB |

## Critical rules enforced

- No agent can grant itself permissions
- No silent production knowledge publishes
- No cross-user notifications
- No fabricated findings or analytics
- Retries create new runs (history preserved)
- Admin routes and functions re-check `has_role('admin')` server-side
- Bootstrap secret never leaves the server

## Database

See `supabase/migrations/002_aether_runtime_extensions.sql` for:
- `notifications` table + RLS
- `task_runs.idempotency_key`, `agent_key`, `retry_of`
- knowledge approval columns
- report metadata columns

## What is intentionally not here yet

- Long-running background worker daemon
- Binary PDF rendering library
- External email transport
- Full Admin Team UI sub-pages (UI was left unchanged by request)
