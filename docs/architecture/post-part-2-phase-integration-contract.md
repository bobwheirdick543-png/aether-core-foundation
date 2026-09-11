# Aether AI Platform — Post-Part 2 Phase Integration Contract

Date: 2026-09-11
Repository: `bobwheirdick543-png/aether-core-foundation`
Status: Authoritative engineering overlay for Phases A–Z and production readiness

## Purpose

This document applies the newly added Post-Part 2 architecture to **every phase**, rather than treating each phase as an isolated feature. The Post-Part 2 Master Implementation Plan remains the phase-definition source; this document is the integration contract that every implementation must satisfy.

The target architecture is:

```text
User / Web / WhatsApp / API
        ↓
Authentication + Permission Engine
        ↓
Cognitive Orchestrator
        ↕
Model Router ↔ Model Providers / Future Self-Hosted Models
        ↕
Memory + Projects + Approved Knowledge + Retrieval
        ↕
Tools + Ten Specialized Agents + Module Runtime
        ↕
Durable Tasks + Workers + Scheduler + Approvals + Notifications
        ↕
Reports + Storage + Audit + Security + Observability + Evaluation
```

No phase may introduce a parallel architecture that bypasses these boundaries.

## Universal requirements for every phase

Every phase must provide, where applicable:

1. **Real backend path** — no advertised capability may depend on fabricated/demo state.
2. **Durable identity** — request/task/run IDs must propagate through long-running work.
3. **Persistence** — durable state belongs in the database/storage layer, not browser-only state.
4. **Authorization** — private resources are ownership-checked; privileged actions are enforced server-side.
5. **Project isolation** — project-scoped data is filtered and authorized at every read/write boundary.
6. **Agent boundaries** — agents execute only within declared tools, permissions, mission and territory.
7. **Model independence** — provider-specific identifiers and credentials stay behind adapters.
8. **Failure handling** — explicit loading, failure, retry, timeout, cancellation and recovery behavior.
9. **Observability** — structured, secret-redacted logs/events/metrics with correlation IDs.
10. **Idempotency** — retries/restarts cannot duplicate irreversible operations.
11. **Versioning/provenance** — important artifacts, configurations and knowledge changes remain auditable.
12. **Realtime reconstruction** — browser closure must not terminate durable work; reopening reconstructs state from persisted records.
13. **Security boundary** — database/storage policies are part of authorization, not merely UI restrictions.
14. **Testing** — unit, integration, security, recovery and regression coverage appropriate to the capability.
15. **Documentation/migrations** — every durable architectural change has migration and decision documentation.

## Phase-by-phase architecture overlay

### Phase A — Core Aether Runtime

**Must integrate:** authentication/permission evaluation → context assembly → memory/knowledge retrieval → planning → tools/agents → evaluation → response/action → telemetry.

**Required contracts:** canonical task/run ID, durable queue, worker lease/heartbeat, task states, chronological events, idempotency, cancellation propagation, timeout/retry budgets, crash recovery, quotas, dead-letter handling and secret-safe execution logs.

**Integration rule:** all later long-running phases reuse this runtime rather than creating their own task engine.

### Phase B — Cognitive Orchestrator

**Must integrate:** typed plans, intent, capabilities, context budget, model role, tools, agents, expected outputs, risk and approvals.

**Required controls:** policy gates before execution, deterministic routing, delegation without permission bypass, intermediate evaluation, structured escalation, provider/tool fallback and traceable selection reasons.

**Integration rule:** the Orchestrator plans and delegates; it does not grant itself permissions or bypass runtime policy.

### Phase C — Model Layer

**Must integrate:** six product roles — Fast, Think, Code, Vision, Long, Translate — over replaceable provider adapters.

**Required controls:** capability registry, context limits, structured output/tool calling, streaming, multimodal support where available, health checks, circuit breakers, fallback routing, usage/cost telemetry and server-only credentials.

**Integration rule:** product roles never become hard-coded provider/model dependencies elsewhere in the platform.

### Phase D — Chat Workspace

**Must integrate:** real conversations with the durable runtime and model abstraction.

**Required capabilities:** conversation/message persistence, streaming, retry/regenerate/stop, model routing, project context, memory controls, real research gate, secure attachments, citations/source cards, search/history pagination and complete UX states.

**Integration rule:** chat is a client of the platform runtime, not an alternative orchestration layer.

### Phase E — Memory System

**Must integrate:** bounded short-term context, durable user memory, isolated project memory, relevance ranking and provenance.

**Required controls:** visibility/edit/delete/disable/export, sensitive-data protection, contradiction/staleness evaluation and strict cross-user/project isolation.

**Integration rule:** memory retrieval is permission-aware and participates in context budgeting; memory cannot silently become production knowledge.

### Phase F — Native Research Engine

**Must integrate:** durable runtime, project scope, policy, source provenance, quality/freshness, retrieval attempts, source versions, comparisons and realtime execution events.

**Required controls:** safe public-target retrieval, robots/limits, retries, cancellation, redirects, normalization, deduplication, hashing, stale detection, multi-source planning and controlled comparison.

**Integration rule:** Native Research remains provider-independent and is the source layer for Verification; external model research is optional and never replaces the native path.

### Phase G — Verification Agent

**Must integrate:** Phase F research sources → structured claims/evidence → verification task → policy/review gate → durable decision.

**Required controls:** claim/evidence provenance, agreement, contradiction, missing evidence, date mismatch, uncertainty, evidence strength, authority, freshness and statuses `VERIFIED`, `NEEDS_REVIEW`, `CONFLICTING`, `UNSUPPORTED`, `OUTDATED`, `REJECTED`.

**Integration rule:** Verification may recommend/decide verification state but cannot publish production knowledge. Human review is required where policy demands it.

### Phase H — Knowledge Acquisition & Curator

**Must integrate:** approved research/verification outputs into candidate knowledge, review queue, versioned production knowledge and provenance.

**Required controls:** document/image/OCR extraction where available, claims/entities/relationships, duplicates/conflicts/outdatedness, proposed changes, approve/reject/edit/request-review, rollback, source links and change notes.

**Integration rule:** acquisition is separated from publication; only approved curator actions can publish production knowledge.

### Phase I — Retrieval / RAG / Knowledge Graph

**Must integrate:** approved knowledge, projects, permissions and source/version provenance into model context.

**Required controls:** hybrid lexical/semantic/metadata retrieval, replaceable embeddings interface, permission filtering before model exposure, source-aware results, optional graph relationships, evaluation sets and stale-index rebuild workflows.

**Integration rule:** retrieval must never return data the caller is not authorized to see.

### Phase J — Reports & PDF Agent

**Must integrate:** structured research/verification/knowledge/task data into deterministic report generation.

**Required controls:** branded/versioned reports, run/session ID, source list, verification status, unresolved claims, approval state, safe filenames, private storage, signed authorized access, regeneration as new versions and crash/large-document tests.

**Integration rule:** PDFs are artifacts of structured data, not opaque model output, and remain ownership-controlled.

### Phase K — Notification & Delivery Agent

**Must integrate:** durable task/report/schedule/review/security events into recipient-safe notifications.

**Required controls:** recipient, event type, payload, source task, delivery/read state, retries, failure recording, in-app center, provider abstraction, preferences/unsubscribe and authorization-safe action links.

**Integration rule:** recipients are explicit durable identities; arbitrary task content cannot choose notification recipients.

### Phase L — Scheduling & Background Automation

**Must integrate:** scheduler → durable task queue → workers → runtime → notifications/history.

**Required controls:** one-time/delayed/recurring/interval/date-range/event schedules, timezone, leases/locks, idempotency, missed-run policy, pause/resume/edit/delete authorization, execution history, failure reporting and quotas.

**Integration rule:** schedules create durable tasks; they do not execute business logic directly in a browser.

### Phase M — Agent SDK & Ten-Agent Runtime

**Must integrate:** all specialized agents with the common runtime, permissions, tools and telemetry.

**Required controls:** typed manifests, mission/territory, prohibited actions, inputs/outputs, tools, permissions, runtime/quality/timeout/retry/escalation/schedule/telemetry configuration, central registry, sandboxing, inter-agent messages, version history and `DRAFT → VALIDATE → TEST → ACTIVATE` lifecycle with rollback.

**Integration rule:** an agent cannot modify its own permission boundary.

### Phase N — Orchestrator Agent

**Must integrate:** Phase B orchestration with M agent registry and A durable runtime.

**Required controls:** typed multi-agent plans, dependency management, approval/verification gates, provenance-preserving aggregation, partial failure handling, targeted retries, escalation and safe final responses.

**Integration rule:** this becomes the real coordinator; specialized agents remain bounded workers, not competing orchestrators.

### Phase O — Security & Compliance Agent

**Must integrate:** real runtime/security/audit events from every layer.

**Required controls:** authentication anomalies, permission violations, cross-user access attempts, API anomalies, dangerous configuration, resource abuse and agent-boundary violations; severity/confidence classification; incidents, acknowledgement, resolution and audit trails.

**Integration rule:** Security Agent analyzes/recommends; enforcement remains in runtime and policy layers so the agent cannot become a bypassable gate.

### Phase P — Optimization Agent

**Must integrate:** real observability/evaluation telemetry and configuration history.

**Required controls:** duration, failures, retries, timeouts, queue/resource usage, verification outcomes, rejection and bottleneck analysis; evidence-backed recommendations; admin approval; controlled evaluation and rollback.

**Integration rule:** optimization cannot silently modify production behavior or fabricate improvements.

### Phase Q — Module Agent & Extensible Module System

**Must integrate:** module manifests and lifecycle into the central registry/runtime.

**Required controls:** ID/version/commands/schemas/permissions/handlers/config/dependencies, sandboxing, storage isolation, install/validate/activate/deactivate/version/rollback and registry governance.

**Integration rule:** modules cannot access arbitrary credentials, production databases or unrelated user data.

### Phase R — Battle Versia

**Must integrate:** Battle Versia as a real module using Q, M and A rather than embedding game logic in WhatsApp handlers.

**Required controls:** deterministic server/game lifecycle, joining/slots, auctions/timers, character hierarchy/stats/pricing/versioning, Yons economy/transactions/market/bank/rewards, creator/bot/super-admin configuration restrictions, audit logs, display-name/moniker UX, deterministic replay/simulation and persistence.

**Integration rule:** game outcomes are auditable and deterministic; internal JID/LID/phone identifiers are never exposed as player-facing identity.

### Phase S — Developer API

**Must integrate:** authenticated API requests into the same permission/runtime/task/model/research/knowledge/report/module boundaries.

**Required controls:** hashed API keys, prefixes, scopes, expiration, revocation, rotation, quotas, request IDs, rate limiting, idempotency, audit logs, stable versioned contracts, structured errors and real usage telemetry.

**Integration rule:** API consumers receive only explicitly scoped capabilities; service-role/provider secrets never leave server-side secret storage.

### Phase T — Complete Website Product Surface

**Must integrate:** every page with the actual backend capability it advertises.

**Required states:** loading, empty, error, denied, not-found, success, retry and mobile/desktop behavior. Include onboarding, profile, projects, files, chat, models, memory, knowledge, research, reports, tasks, developers/API and settings.

**Integration rule:** navigation and Back behavior are universal; admin surfaces remain authorization-protected and hidden from ordinary user UX.

### Phase U — Admin Command Center

**Must integrate:** real telemetry, runtime, security, agents, knowledge, research, tasks, APIs and configuration.

**Required controls:** secure user/admin actions, model configuration, agent status/configuration, knowledge approvals, research/verification, task controls, API keys, usage, logs, system health and safe settings.

**Integration rule:** every admin mutation is server-authorized, audited and protected by final-admin safety rules.

### Phase V — Evaluation Lab

**Must integrate:** all agents, orchestrator, models, research, verification, knowledge, reports, notifications, modules and Battle Versia.

**Required controls:** reproducible test cases, expected/actual outputs, scores, evaluator/version/environment, success/latency/failure/retry/approval/contradiction/resource metrics, regression triggers and controlled model/provider comparisons.

**Integration rule:** evaluation results are evidence-backed engineering measurements, not marketing claims.

### Phase W — Observability & Operations

**Must integrate:** every runtime layer using request/task/run correlation.

**Required controls:** structured logs, metrics, traces, task/agent/model/tool/security events, queue/worker health, latency/errors/retries/timeouts, research/verification/report/notification/storage dashboards, secret redaction, alerts, health/readiness/liveness, backups and recovery procedures.

**Integration rule:** dashboards are derived from real telemetry; no synthetic activity is permitted.

### Phase X — Security Hardening

**Must integrate:** every route, server function, database/storage policy, task, report, notification and API endpoint.

**Required controls:** authorization audit, IDOR/cross-user tests, privilege escalation/self-admin tests, session/recovery/logout safety, server-only secrets, dependency scanning, rate limits/abuse controls, input/upload validation, sandboxing, secure headers/CSRF/CORS/cookies and privileged audit trails.

**Integration rule:** security is a platform property and cannot be delegated solely to UI or an AI agent.

### Phase Y — Data Lifecycle & Reliability

**Must integrate:** all durable records and artifacts across the platform.

**Required controls:** retention, deletion/export, archival/soft delete, repeatable migrations, backup restoration, abrupt worker termination recovery, partial multi-agent failure recovery, duplicate event/task handling and storage/signed-URL failure tests.

**Integration rule:** lifecycle policies must be explicit, auditable and consistent across user, project and platform scopes.

### Phase Z — WhatsApp Interface

**Must integrate:** WhatsApp as an adapter over Aether APIs/modules.

**Required controls:** secure identity mapping, scoped capabilities, Battle Versia module commands, pairing/session lifecycle, reconnect/delivery failure handling, rate limits/retries and privileged-action audit logs.

**Integration rule:** WhatsApp formatting/transport stays separate from core business logic; it cannot become a second backend implementation.

## Production Readiness overlay

Before production, the whole architecture must also satisfy:

- development/staging/production separation;
- server-side secrets and rotation;
- CI for typecheck, lint, tests, migrations, build and security scanning;
- safe migration deployment;
- independent verification of storage, email, scheduler, workers, queues and application servers;
- monitoring and rollback procedures;
- deployment/incident/backups/recovery documentation;
- secure domain/HTTPS/DNS/email/status configuration when ready.

## Cross-phase dependency rules

1. **A is the only durable task/worker foundation.** Later phases reuse it.
2. **B/N are the orchestration boundary.** Feature-specific code must not silently create competing orchestration engines.
3. **C owns provider abstraction.** No feature may hard-code a model provider as its architecture.
4. **E/I own memory and retrieval boundaries.** Agents do not bypass permission-aware retrieval.
5. **F/G/H/I form a governed knowledge chain:** research → verification → acquisition/approval → production retrieval.
6. **J/K/L consume durable runtime events and artifacts.** Browser state is never the source of truth.
7. **M/Q define extension boundaries.** Agents/modules are registered, versioned, permissioned and sandboxed.
8. **O/X enforce security through platform policy.** AI agents are not the ultimate authorization layer.
9. **V/W derive from real execution data.** Analytics cannot be invented for UI completeness.
10. **Y applies lifecycle/recovery requirements to every durable subsystem.**
11. **Z is transport/interface only.** WhatsApp must call the same core capabilities used by Web/API.

## Required phase completion gate

A phase is not complete merely because its screens, functions or database tables exist. A phase is complete only when its advertised capabilities have a real backend path, durable persistence where required, authorization, failure/recovery behavior, observability, tests and integration with the target architecture.

For cross-phase capabilities, the completion test must prove the full chain rather than an isolated function.

## Final Aether acceptance chain

```text
Fresh user
 → authentication/verification/onboarding
 → project
 → chat
 → durable runtime
 → model routing
 → memory/project context
 → research
 → verification
 → knowledge acquisition/approval
 → retrieval/RAG
 → report generation/private storage
 → notification
 → scheduled/background execution
 → agent/module execution
 → admin/security/evaluation/observability
 → API/WhatsApp interfaces
 → failure/retry/recovery
 → backup/restore
 → complete audit trail
```

The final system must remain provider-independent, permission-safe, project-isolated, durable across browser/process restarts, observable, recoverable and free of fabricated operational state.

## Engineering rule

The Post-Part 2 Master Plan says to inspect the current implementation before editing, preserve working functionality, prefer incremental changes with tests, use real persistence, enforce server-side authorization, separate agents/models/tools/modules, preserve provenance/versioning, make failures recoverable and observable, maintain the Aether visual/navigation system, document migrations/architecture decisions and never expose secrets. This contract applies those rules uniformly across every phase.
