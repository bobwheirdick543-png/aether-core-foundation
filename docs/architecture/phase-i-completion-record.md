# Phase I Completion Record — Retrieval / RAG / Knowledge Graph

## Status
Implementation complete pending final CI gate.

## Architecture contract
Phase I consumes only approved production knowledge from Phase H. Candidate/research/verification records remain outside the retrieval index. Retrieval is permission-aware and project-scoped, and results preserve entry/version provenance.

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
- No Vercel deployment or deployment configuration was added by Phase I.

## Phase I → Phase J boundary
Reports consume retrieved, permission-filtered, version-aware knowledge through the same core runtime rather than bypassing retrieval controls.
