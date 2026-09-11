# Phase H Completion Record — Knowledge Acquisition & Curator

Status: **COMPLETE**

Phase H implements the post-Part-2 architecture boundary between research/verification and production knowledge:

`Research (F) → Verification (G) → Candidate Knowledge (H) → Curator Approval → Production Knowledge → Retrieval (I)`

## Delivered

- Durable candidate-knowledge layer isolated from production knowledge.
- Deterministic extraction of claims, entities and relations with SHA-256 content/claim fingerprints.
- Research/verification provenance carried into candidates and retained through publication.
- Candidate lifecycle: candidate, needs_review, approved, rejected, published, superseded, outdated, conflicted.
- Verification gate: only verified claims can be approved; conflicted, stale and deprecated candidates cannot publish.
- Duplicate and overlapping-claim conflict detection.
- Freshness states: current, aging, stale, superseded, conflicted, deprecated.
- Curator decisions with actor, previous/new status, reason and audit metadata.
- Governed publication into the existing production `knowledge_entries` model.
- Immutable Phase H version history with edit/publication/rollback records.
- Production rollback creates a new version rather than overwriting history.
- Candidate entities and relations persisted for future Phase I retrieval/graph use.
- Ownership/project isolation and server-authoritative writes; H tables expose read policies only, while mutations use the server/admin boundary after ownership checks.
- Existing production knowledge entry/version writes hardened to server-governed access.
- Durable task/task-run records for acquisition operations, including completion/failure state.
- Knowledge Curator and Knowledge Acquisition Agent contracts activated with bounded territory and no self-escalation.
- Verification workspace now exposes an explicit **Acquire verified** handoff into the H curator queue.
- Knowledge workspace now provides candidate review, approval/rejection/edit/request-verification, publication, production entries and version rollback UI.
- Phase H focused TypeScript validation, unit tests and production build gate.

## Validation

Final Phase H validation run: `34602682139` (pull-request validation against the complete Phase H implementation).

- dependency installation: passed
- focused Phase H TypeScript validation: passed
- Phase H engine tests: **5/5 passed**
- production build and route generation: passed
- workflow job: **success**

An earlier Phase H test run caught an incorrect freshness fixture (a date more than 180 days old was expected to be `aging`). The fixture was corrected to a date inside the documented 30–180 day `aging` window, and the final validation passed.

## Security review

Supabase security advisor was checked after the Phase H migration/hardening. No new Phase H verification/knowledge warning was introduced; remaining findings are pre-existing platform findings.

## Architecture boundary

Phase H does **not** turn research or verification output directly into trusted knowledge. Acquisition creates a candidate, curator governance approves it, and only the explicit publication gate writes to production knowledge. Phase I can therefore consume a stable, versioned, provenance-bearing production layer rather than raw research output.
