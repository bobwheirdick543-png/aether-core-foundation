# Phase F Completion Record

Date: 2026-09-11
Repository: `bobwheirdick543-png/aether-core-foundation`
Branch: `main`

## Completion result

Phase F implementation is complete on `main`.

The historical `phase-f-audit-gap-matrix.md` remains as the F0/F14 gap-tracking artifact from the implementation process. This record is the final completion gate after the remaining gaps were implemented.

## Final gate

- Native provider-independent retrieval remains the source of truth.
- Multi-source planning is bounded and persisted.
- Retrieval has public HTTP validation, robots handling, size/content-type limits, timeout/deadline handling, cancellation propagation, retries, redirect limits, redirect-loop detection, redirect-chain provenance, canonical normalization, metadata extraction, hashing, stale/quality signals, and parser warnings.
- Server-side research execution carries project scope and is owned by the durable runtime worker.
- Runtime cancellation and deadlines propagate into retrieval through an AbortSignal watcher; browser closure is not the runtime lifecycle.
- Source versions and change state are persisted across repeated retrievals.
- Retrieval attempts, policy events, research plans, comparisons, discovery events, task/run identifiers, and project scope have durable database contracts.
- Controlled comparisons persist missing evidence and uncertainty.
- Discovery events are immutable and realtime-capable.
- Research reads enforce owner and optional project scope.
- Research session index/deep navigation reconstructs persisted sessions, plans, sources, provenance, freshness, quality, and comparisons.
- DNS public-target enforcement is available on the server-side direct-fetch execution path; native retrieval itself also rejects private host targets before network access.
- Phase F migration contracts are applied to the connected Supabase project.
- Security cleanup was applied for the Phase F internal immutable-event trigger; remaining Supabase advisor warnings are pre-existing project-wide findings outside the Phase F change set.

## Validation

The dedicated `Phase F validation` GitHub Actions run for the final `main` commit completed successfully. It performs:

1. dependency installation,
2. project build/route generation,
3. focused Phase F TypeScript checking,
4. Phase F research/security/completion-gate tests.

The connected Supabase project reports the Phase F migrations applied, including native research hardening, comparison/realtime completion, security executor hardening, project-scope repair, policy/index cleanup, and policy repair.
