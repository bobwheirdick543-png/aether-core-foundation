# Aether Runtime Architecture (Foundation)

This document describes the **real** modular foundation implemented under `src/lib/aether` and the Phase A worker process under `scripts/`.

No external AI provider is required for Aether's base web discovery/retrieval layer. No fabricated agent activity or analytics.

## Layers

```
User / Admin / API / Agent request
        ↓
Server functions (auth + ownership)
        ↓
Cognitive Orchestrator (planWorkflow / decideNext)
        ↓
Durable Task / Run queue
        ↓
Phase A runtime worker (lease + heartbeat + recovery)
        ↓
Agent boundary checks (security.ts)
        ↓
Domain executor / AAX capability
        ↓
Aether Web Intelligence
   ├── Wikipedia
   ├── Reddit
   ├── DuckDuckGo discovery
   ├── dictionary/lexical lookup
   └── direct URL retrieval
        ↓
Native Research Engine (fetch + extract + provenance)
        ↓
Knowledge pipeline / Report builder / Notifications
        ↓
Persistent result + audit events + telemetry
```

The durable runtime is the execution boundary between orchestration and domain work. The browser is never the owner of long-running execution.

## Phase A durable runtime

Phase A provides:

- Durable `tasks` and immutable `task_runs` with explicit lifecycle states.
- A PostgreSQL-backed queue using transactional `FOR UPDATE SKIP LOCKED` claiming.
- Worker leases, heartbeats, worker identity and capacity metadata.
- Deadline and cancellation-aware claiming.
- Platform, user and project concurrency limits at claim time.
- Persistent event sequencing for task/run history.
- Cooperative cancellation and pause/resume controls.
- Expired-lease recovery for worker crashes.
- Timeout and retry-budget enforcement with dead-letter records.
- Immutable retry attempts: a retry creates a new `task_runs` record linked by `retry_of`; the previous attempt remains historical truth.
- Idempotent task/run creation keys to prevent duplicate submissions.
- Durable retry scheduling through `schedule_runtime_retry`.
- A long-running worker entrypoint at `scripts/aether-runtime-worker.ts` that polls the durable queue, recovers expired work, claims leases, heartbeats active runs, dispatches registered executors, and records real failures.
- Graceful worker draining/offline state on process termination.

The worker is deliberately separate from the web request lifecycle. It must run as a persistent server-side process in the production worker environment; the web application does not impersonate a daemon.

## Key modules

| Module | Role |
|--------|------|
| `agents.ts` | Static agent workforce definitions + least-privilege permissions |
| `agent-sdk.ts` | Input/output contracts, policies, messaging |
| `task-runtime.ts` | Task vs Run, state machine, ownership helpers |
| `task-service.ts` | Create task/run, transition status |
| `task.functions.ts` | Authenticated create/list/get |
| `task-control.functions.ts` | Cancel + pause/resume + retry |
| `executor.ts` | Controlled domain execution invoked by the universal runtime worker |
| `research-engine.ts` | Native URL retrieval + metadata extraction |
| `aax-web-intelligence.ts` | Provider-independent concurrent multi-source discovery, retrieval, deduplication and research persistence |
| `aax-web-research.ts` | AAX chat web-research adapter; native web intelligence by default, optional provider fallback |
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
| `scripts/aether-runtime-worker.ts` | Persistent Phase A worker process |

## Native Web Intelligence

Aether separates **web access** from **model reasoning**. Search providers run concurrently and their results are deduplicated before page retrieval. Retrieved pages retain URL, canonical URL, title, domain, provider, timestamps, content hash and evidence text. The base discovery layer uses public web endpoints and therefore does not require a search-provider API key.

AAX web research uses this layer by default. A provider-native search path remains available only as an explicit fallback configuration; it is not the foundation of Aether web access.

During AAX knowledge evolution, Knowledge Acquisition, Research, Verification, Curator and Security each receive an independent native research pass. Web evidence is appended to that agent's identifiable understanding artifact and persisted with the research session, while the original source remains preserved. The target AAX then receives the collective package and performs its own self-analysis.

The native layer is deliberately provider-independent. Additional search indexes or commercial providers can be added behind the same capability contract later without changing agents, models, chat, or the public API.

## Critical rules enforced

- No agent can grant itself permissions
- No silent production knowledge publishes
- No cross-user notifications
- No fabricated findings or analytics
- Web content is evidence, not executable instructions
- Search results are not treated as automatically true; multiple sources and source diversity are retained for later verification
- Retries create new immutable runs; previous attempts are never overwritten
- Runtime leases prevent two workers from owning the same run
- Admin routes and functions re-check `has_role('admin')` server-side
- Bootstrap secret never leaves the server
- Unsupported task kinds fail explicitly rather than being reported as successful

## Database

Phase A uses the durable runtime schema and follow-up migrations for:
- `tasks` queue state and ownership
- `task_runs` immutable execution attempts
- `task_events` ordered execution history
- `task_dead_letters` terminal failure records
- `runtime_quotas` platform/user/project execution limits
- `runtime_workers` worker identity and heartbeat state
- claim, recovery and retry RPC primitives

The Phase D native web migration adds:
- `aether_research_sessions` for durable research-run provenance
- `aether_research_sources` for retrieved source records, hashes, metadata and ownership-safe access

## Phase A operational entrypoint

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the worker environment. Optional controls are `AETHER_WORKER_ID`, `AETHER_WORKER_LEASE_SECONDS`, `AETHER_WORKER_POLL_MS`, and `AETHER_WORKER_RECOVERY_MS`.

Run the worker with:

```text
bun run worker:aether
```

Validate its entrypoint without connecting to Supabase with:

```text
SUPABASE_URL=https://example.supabase.co SUPABASE_SERVICE_ROLE_KEY=validation-placeholder bun run scripts/aether-runtime-worker.ts --check
```

The worker is intentionally not exposed as a public web route and does not receive user credentials. The service-role credential remains server-side.

## What remains outside Phase A

- Binary PDF rendering library
- External email transport
- Full Admin Team UI sub-pages (UI was left unchanged by request)
- A proprietary global search index/crawler; current native discovery combines public source endpoints with direct retrieval and is designed to accept additional provider/index adapters later
