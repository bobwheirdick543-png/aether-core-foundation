# Aether Phase M — Agent SDK & Ten-Agent Runtime

Date: 2026-09-11
Status: COMPLETE — implemented, validated and pushed to `main`

## Scope delivered

Phase M integrates the ten-agent workforce with the common Phase A durable runtime and the Post-Part-2 architecture. The implementation adds a central durable registry, typed contract validation, version history, lifecycle gates, runtime permission middleware, durable inter-agent messages/handoffs, bounded sandbox sessions/artifacts and action auditing.

## Lifecycle

Agent configuration is persisted as immutable version records and moves through the guarded lifecycle:

`DRAFT → VALIDATE → TEST → ACTIVATE`

Operational states include `maintenance` and `disabled`. Activation supersedes the previous active version and preserves the previous configuration as a rollback target. Rollback restores a known durable version rather than reconstructing state in the browser.

## Runtime boundary

Assigned agent runs now pass through `agent.execute` authorization in the universal task service. Tool/action authorization uses the central database permission registry and records an `allowed`, `denied` or `approval_required` decision in `agent_action_audit`. Agents cannot grant themselves roles or modify their own permission boundary.

Inter-agent messages are ordered durably per task through a database RPC protected by a row lock. Handoffs reference the message and remain tied to the originating durable task/run. Sandbox sessions are owner/task/run scoped, have bounded TTLs and use deterministic isolated root paths.

## Persistence and account integration

Existing `auth.users`, `profiles`, `user_roles`, `projects`, `tasks` and `task_runs` remain the account/ownership source of truth. Phase M does not create a competing account system. Agent operations carry the authenticated requester/owner identity and project/task boundaries into the shared runtime. Admin mutations are server-side role checked.

## Production database validation

Supabase production project `hpxisijyglkdlcpqjtpd` contains the Phase M migration series and the durable ten-agent registry. Permission checks were smoke-tested against an executable agent and prohibited role mutation. The registry starts with durable version records and no fabricated messages, handoffs, sandbox sessions or action-audit history.

## CI validation

Final Phase M workflow: `34617630038`.

All stages passed:

- focused Agent SDK TypeScript check
- Agent SDK/lifecycle Vitest suite: 4/4 tests passed
- production build (`bun run build:dev`)

Final `main` commit: `3346b038f32f1acf2bbab804b77b53344001cb1f`.

## Files

- `src/lib/aether/agent-sdk.ts` — typed contract surface.
- `src/lib/aether/agent-registry.ts` — canonical registry synchronization, contract validation and version hashing.
- `src/lib/aether/agent-runtime.ts` — lifecycle primitives, server permission boundary, messages, handoffs and sandbox sessions.
- `src/lib/aether/agent.functions.ts` — authenticated/admin control-plane functions.
- `src/routes/_authenticated/admin/agents.tsx` — durable Agent SDK admin control surface.
- `src/lib/aether/__tests__/agent-runtime.test.ts` — contract/lifecycle regression coverage.
- `.github/workflows/phase-m-validation.yml` — typecheck, Agent SDK tests and production build validation.
- `supabase/migrations/20260911180000_phase_m_agent_sdk_and_runtime.sql` plus the Phase M hardening/seed/execution migrations — durable schema and security boundary.

## Architecture relationship

The flow is:

`Auth/Permission → Cognitive Orchestrator → Model Router → Memory/Projects/Knowledge/Retrieval → Tools + Ten Agents → Phase A Durable Tasks/Workers + Phase L Scheduler → Reports/Notifications → Audit/Security/Observability/Evaluation`.

Phase M does not execute work directly from browser state and does not create a second scheduler or task engine. Phase N can therefore build the real coordinator on top of this stable agent registry/runtime contract.

## Deployment note

No Vercel deployment or validation is part of Phase M. Validation was performed through repository CI and direct Supabase schema/runtime checks.
