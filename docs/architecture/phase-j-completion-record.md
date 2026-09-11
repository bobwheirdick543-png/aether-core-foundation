# Phase J — Reports & PDF Agent

Status: **COMPLETE**

Phase J implements the report artifact boundary:

`Research (F) → Verification (G) → Candidate/Curated Knowledge (H) → Retrieval/Provenance (I) → Report/PDF (J)`

## Delivered

- Deterministic report composition from structured evidence; PDF rendering does not require an AI provider.
- Aether branding, report title, research session/run IDs, generation date, source list, verification state, approval state, verified findings, unresolved claims, version, page numbers and footer.
- Deterministic safe filenames and SHA-256 PDF artifact hashes.
- Durable `reports` metadata and immutable `report_versions` with regeneration as a new version.
- Private Supabase Storage bucket `aether-reports` with no direct authenticated-client object policy.
- Server-side signed download URLs after ownership/admin authorization checks.
- User report library plus administrator-capable search/detail/archive operations.
- Durable Phase A task/task-run records around generation and persisted failure state.
- Persisted idempotency keys and audit events for generation/archive actions.
- Failed generation versions remain auditable; uploaded artifacts are removed on post-upload failure.
- Report artifacts remain review artifacts with approval initially `pending`; Phase K owns notification fan-out.

## Validation

`.github/workflows/phase-j-validation.yml` runs dependency installation, focused TypeScript validation, deterministic PDF regression tests and the production build. The workflow uses `bun install` rather than frozen-lockfile mode to match the repository's established phase validation strategy.

## Security / architecture boundary

Report metadata and versions are owner-scoped through RLS. Version writes and storage operations use the server/admin boundary. Signed URLs are short-lived and minted only after access checks. The Report/PDF Agent cannot publish production knowledge or bypass the H approval boundary. The generated report is a durable artifact consumed later by notification/delivery and higher-level orchestrated workflows.
