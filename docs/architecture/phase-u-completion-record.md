# Phase U — Admin Command Center

Phase U activates the administrator control plane over Aether's existing runtime architecture.

## Implemented

- Server-authorized administrator user search, role changes and account ban/unban controls with final-admin protection.
- Real task queue visibility with administrator cancel/retry controls and retry-budget enforcement.
- Knowledge governance review with explicit approve/publish and reject actions, version creation and audit records.
- Research oversight backed by durable research-session records.
- Platform-wide Developer API key visibility with server-side revoke and rotate operations; raw secrets are never persisted.
- Real usage telemetry from API logs, task runs, model metrics and agent metrics, with truthful empty states.
- Structured audit/runtime/API log console with payload-sensitive task event data excluded from the admin listing.
- Runtime system view for worker heartbeats, queue depth, quotas, model availability and agent status.
- Persistent `platform_settings` storage with server-side admin authorization and audit trail.
- Dedicated AAX model-routing control surface. Product model roles remain distinct from provider/model identifiers and credentials remain server-side.
- Existing Agent SDK lifecycle/permission controls remain intact and are surfaced through the existing admin Team/Agents areas.

## Architecture boundary

Admin actions are not client-only controls. Every Phase U server function re-checks the administrator role before reading or mutating privileged data. Runtime actions operate on Aether's durable tasks, runs, models, agents, knowledge and telemetry rather than browser-only state.

The ordinary user experience remains separate from the internal agent workforce. Admins may inspect internal agent and orchestration infrastructure; public/product surfaces do not expose that implementation detail unless deliberately simplified by product design.

## Validation

`phase-u-validation.yml` verifies that required Phase U surfaces are present, placeholder phase-gating text is absent from the admin area, required backend/migration files exist, and the production development build succeeds.

Phase U does not claim overall Aether completion. Evaluation, observability expansion, security hardening, data lifecycle/reliability, WhatsApp and production-readiness phases remain governed by the master plan.
