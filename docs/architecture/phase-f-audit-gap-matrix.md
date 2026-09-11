# Phase F — Audit and Requirement-to-Code Gap Matrix

**Repository:** `bobwheirdick543-png/aether-core-foundation`  
**Branch audited:** `main`  
**Audit basis:** `Aether_Phase_F.pdf` supplied for Phase F implementation.  
**Audit rule:** preserve working Phase D capability and harden incrementally.

## Audit result

The repository already contains substantial Phase F work: native retrieval, URL normalization, source quality/freshness signals, multi-source planning, source comparison, durable task/run integration, Operations Center pages, operation timelines, and Phase F regression tests. The audit therefore treats Phase F as an existing implementation that needs completion/hardening, not as a green-field subsystem.

## Requirement matrix

| Requirement | Current state before this update | This update | Remaining hardening |
|---|---|---|---|
| F0 audit | Partial/implicit | Added this explicit requirement-to-code matrix | Keep matrix updated through F14 |
| F1 production retrieval | Substantial | Existing engine preserved | Add stronger DNS/IP resolution and redirect-loop tracking; propagate cancellation into retrieval; expand encoding/compression handling tests |
| F2 safe parsing/metadata | Partial | Existing title/description/date/canonical extraction preserved | Add author, headings, links, encoding, parser version and parser warnings to the retrieval result and persistence path |
| F3 URL normalization/dedup | Substantial | Existing conservative normalization preserved | Add explicit redirect-chain provenance and stronger canonical-link handling tests |
| F4 hashing/change detection | Partial | Added durable source-version table and change-state contract | Compare against prior source versions during repeated retrieval and expose changes downstream |
| F5 access policy/rate limits | Partial | Added bounded policy primitives, retry classification/backoff helpers, and policy-event persistence | Wire limiter into every provider/retrieval path and persist deferred/rate-limited events at execution time |
| F6 durable persistence | Substantial | Added retrieval-attempt and source-version persistence; failed sources are persisted | Persist every individual attempt including retries, cancellation and recovery transitions; include project scope in all research writes |
| F7 quality/freshness | Substantial | Existing transparent score/factors preserved | Persist explicit stale reason and make source-quality signals available to comparison/verification APIs |
| F8 multi-source planning | Substantial | Planned queries are now bounded to two concurrent query workers; unmet source/domain requirements are calculated and persisted | Track every discovery step/query event and support orchestrator child-task execution where needed |
| F9 controlled comparison | Substantial | Existing non-verifying comparison preserved | Improve agreement/contradiction evidence extraction and persist missing-evidence/uncertainty records as first-class fields |
| F10 durable runtime | Substantial | Existing universal task/run path preserved | Verify all cancellation/recovery/idempotency cases against the real runtime and avoid competing task engines |
| F11 Operations Center | Substantial | Existing operation detail/timeline implementation preserved | Confirm all research events are server-authoritative, immutable, persisted, and realtime-reconstructed after browser closure |
| F12 research UI/navigation | Substantial | Existing research/operations routes preserved | Complete source/session/plan/comparison deep pages where not already present; ensure Back/breadcrumb/deep-link reconstruction everywhere |
| F13 security/isolation | Partial/substantial | Added project-scoped research persistence columns and additive RLS for new records | Enforce project ownership on every research read/write and test cross-user/cross-project leakage; strengthen SSRF/DNS-rebinding defenses |
| F14 tests/docs/completion gate | Partial | Expanded Phase F contracts and documented the audit | Add integration tests using mocked retrieval/runtime/persistence and a final completion gate that exercises the full durable research lifecycle |

## Code inventory inspected

### Native research

- `src/lib/aether/research-engine.ts` — bounded HTTP retrieval, redirect handling, retries, content limits, content-type validation, robots checks, normalization, hashing, freshness and quality signals.
- `src/lib/aether/aax-web-intelligence.ts` — Wikipedia, Reddit, DuckDuckGo HTML and dictionary provider adapters, retrieval orchestration, source deduplication, research persistence.
- `src/lib/aether/research-planner.ts` — bounded research plans and controlled source comparison.
- `src/lib/aether/research.functions.ts` — authenticated research entry point and durable task/run creation.
- `src/lib/aether/__tests__/phase-f-research.test.ts` — Phase F contract/regression tests.

### Durable execution / operations

- `src/lib/aether/task-runtime.ts`
- `src/lib/aether/task-service.ts`
- `src/lib/aether/runtime-worker.ts`
- `src/lib/aether/executor.ts`
- `src/lib/workspace/operations.functions.ts`
- `src/routes/_authenticated/operations.tsx`
- `src/routes/_authenticated/operations/$operationId.tsx`

These existing runtime/operations components must remain the canonical execution layer. Phase F must not introduce a separate research task engine.

### Persistence

Existing research persistence is in `aether_research_sessions` and `aether_research_sources`. The Phase F hardening migration adds:

- `aether_research_source_versions`
- `aether_research_retrieval_attempts`
- `aether_research_plans`
- `aether_research_comparisons`
- `aether_research_policy_events`

It also adds additive provenance/metadata columns to existing research records.

## Learning-chain boundary

The Phase F implementation must preserve this boundary exactly:

`Research → Research Session → Retrieved Source + Metadata + Hash → Structured Evidence Candidate → Quality/Freshness/Comparison → Phase G Verification → Phase H Acquisition/Curator → Approved Aether Knowledge → Phase I Retrieval/RAG/Graph → AAX specialization`

Retrieved web material is **not** automatically verified or promoted to permanent Aether knowledge.

## Security review priorities

1. Reject non-public HTTP(S) targets before retrieval.
2. Never bypass robots, authentication, access controls or technical protections.
3. Bound request duration, redirects, response bytes, retries and concurrency.
4. Treat redirect targets as fresh security decisions.
5. Do not trust a canonical URL as proof of identity; retain the originally requested URL and redirect provenance.
6. Keep research records scoped to the authenticated owner and project.
7. Keep provider credentials server-side.
8. Treat source quality as a signal, never as proof of truth.
9. Persist policy blocks/failures rather than silently dropping them.

## Verification before declaring Phase F complete

A final completion gate must demonstrate a real request that:

1. creates a durable operation/task/run;
2. plans bounded multi-source research;
3. retrieves public sources under limits and policy;
4. records successful and failed retrieval attempts;
5. stores normalized/canonical URL provenance;
6. stores content hashes and historical source versions;
7. exposes change and freshness state;
8. records quality factors without declaring truth;
9. compares sources without turning comparison into verification;
10. survives browser closure and reconstructs from persistence;
11. emits server-authoritative operation events;
12. enforces user/project isolation; and
13. passes the Phase D regression suite plus the complete Phase F test suite.

This document is intentionally an audit artifact, not a claim that all remaining F1–F14 work is already complete.
