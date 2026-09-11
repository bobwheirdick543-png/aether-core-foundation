# Phase I Completion Record — Retrieval / RAG / Knowledge Graph

## Status
Phase I complete and validated on main.

## Architecture contract
Phase I consumes only approved production knowledge from Phase H. Candidate/research/verification records remain outside the retrieval index. Retrieval is permission-aware and project-scoped, and results preserve entry/version provenance. Phase I is a core runtime capability and does not deploy to Vercel.

## Implemented
- Chunked production knowledge index with content hashes and version awareness.
- Replaceable embedding-provider contract with a deterministic offline baseline adapter.
- Vector storage and ANN index using pgvector.
- Lexical, semantic and hybrid ranking with explicit score components.
- Knowledge graph nodes/edges sourced from curated entities and relations.
- Graph-aware retrieval mode and bounded graph signal contribution.
- Durable retrieval run/result records for observability and audit.
- Durable index jobs with retryable failed state.
- Automatic stale-index rebuild queueing when production knowledge changes.
- Owner and project authorization at the server boundary and RLS read boundary.
- Retrieval workspace UI with mode selection, provenance and index status.
- Explicit ACL hardening for the stale-index trigger function.
- No Vercel deployment or deployment configuration was added by Phase I.

## Validation
- Focused Phase I TypeScript check: passed.
- Phase I retrieval engine tests: passed.
- Production build: passed.
- GitHub Actions Phase I final gate: passed.
- Supabase migration applied and security advisor rechecked; Phase I reindex function is no longer reported as publicly executable.

## Phase I → Phase J boundary
Reports consume retrieved, permission-filtered, version-aware knowledge through the same core runtime rather than bypassing retrieval controls.
