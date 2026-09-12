# Phase W — Observability & Operations Completion Record

Status: **implemented on `phase-w-observability-operations`; ready for merge after validation.**

## Architecture boundary

Phase W is a cross-cutting platform capability, not a separate execution system:

`Interface → Auth/Permissions → Cognitive Orchestrator → Model Router → Agents/Tools/Knowledge → Durable Task/Run → Worker → Result`

Global observability follows that same path through shared trace/request correlation, structured events, execution spans and metric samples. Phase U remains the server-authorized operational command center, while Phase V can consume the resulting real execution measurements.

## Completed capabilities

- Durable global observability event storage with severity, component, event type, correlation IDs, execution identifiers, outcome, duration, retryability and bounded metadata.
- Durable execution span storage with trace ID, span ID, parent span ID, lifecycle status, duration and error code.
- Durable metric sample storage for real platform/resource measurements.
- Shared server-side `observability.ts` context, event, span and metric APIs.
- Credential/secret metadata redaction and bearer-token message redaction.
- Fail-open telemetry writes so telemetry outages do not break primary Aether execution.
- Phase A runtime worker lifecycle/recovery/heartbeat/retry/execution instrumentation.
- Server-authorized operations API with admin-only observability access.
- Operations dashboard showing real worker health, queue/active work, success/failure rate, latency, retries, approvals/rejections, telemetry, traces, resource samples and operational alerts.
- Real alert derivation for offline workers, queue backlog, recent error spikes and elevated retry pressure.
- Explicit empty states when no real telemetry/resource data exists; no synthetic health or activity.
- Automated Phase W validation workflow covering observability contracts, Phase V evaluation contracts, worker entrypoint validation and the production build.

## Global rules

Observability is intentionally global where the concern is platform-wide: correlation, structured logging/events, spans, metrics, redaction and operational health. User/project/evaluation/task data remains scoped by its existing ownership boundaries. Detailed internal traces remain an authorized operational surface and are not exposed through the public product surface.

## Validation boundary

The validation workflow runs Bun tests, the worker configuration check and the existing production build command. External Supabase state is not fabricated by the workflow. A successful local/CI build validates code and contracts; actual worker health and production telemetry require the configured runtime and database environment.
