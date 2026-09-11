# Phase E — Memory + Projects

> Phase E is the implementation name used for the fifth workstream in the master plan's recommended order: **Memory + projects**. The master plan itself lists this as item 5 rather than defining a formal `Phase E` heading.

## Scope

Phase E makes memory and projects durable, isolated platform capabilities that sit between the model router and the rest of Aether's knowledge/tool/runtime layers.

The implementation preserves the master-plan separation between:

- short-term conversation context;
- approved long-term user memory;
- project-scoped memory;
- broader approved knowledge;
- raw/candidate knowledge and production knowledge.

## Durable memory

`aether_memories` stores approved/explicit durable memory. Each row is owned by a user and is either:

- `global` — available across that user's projects;
- `project` — available only inside the owning project.

Memory records carry type, content, reason, confidence, importance, persistence mode, version, provenance references, usage timestamps, and deletion state.

Active memory is the only memory eligible for retrieval. Deleted and superseded records remain available for audit/history but are excluded from normal retrieval.

## Governed learning candidates

`aether_memory_candidates` is deliberately separate from production memory. A candidate is not retrieved by the chat runtime until it is promoted.

Promotion is performed by a server-side `SECURITY DEFINER` RPC that verifies the acting user owns both the candidate and its project scope, creates the durable memory record, marks the candidate as promoted, and writes an audit event.

This prevents a model or ordinary client write from silently turning conversation content into permanent memory.

## Versioning and provenance

Memory edits do not overwrite the previous active record. `replace_aether_memory` creates a new version, links it through `previous_memory_id`, marks the old version as `superseded`, and records both sides of the transition in `aether_memory_events`.

Memory events capture creation, retrieval, update/supersession, deletion, candidate review, promotion, and export-related activity, with source conversation/task references where available.

## Retrieval

Aether chat retrieves a bounded set of active memories using the authenticated user's identity and the current conversation's project scope. Global memory can participate in a project conversation; project memory can participate only when its project matches the conversation.

The runtime also respects both the user-level `profiles.memory_enabled` setting and the selected project's `projects.memory_enabled` setting. Disabling project memory removes project-scoped memories from the retrieval context while preserving eligible global memory.

Retrieved memories are inserted as an explicitly labelled system context so they are treated as user-provided persistent context rather than executable instructions.

## Projects

Projects are durable owner-scoped workspaces. Phase E provides:

- creation, editing, archiving, restoring, and permanent deletion;
- ownership checks on every server operation;
- project-scoped AAX conversations;
- project memory;
- private project file storage;
- project workspace inspection;
- signed, short-lived project-file download URLs.

Deleting a project removes its project-scoped relational data through database cascades and explicitly removes registered project files from private object storage before the project row is deleted.

## Project files

`aether_project_files` stores file metadata and extraction state separately from Supabase Storage. Files are limited to 25 MB and restricted to the supported document/image MIME set.

Storage paths are structured as `<user-id>/<project-id>/<file>`. Database ownership policies and Storage policies both require the authenticated user to own the referenced project. This makes the storage boundary independent of client-side project selection.

## Chat integration

AAX conversations can be created or updated with a project and a persistent memory preference. The authenticated chat route resolves the persisted conversation project before retrieving memory, rather than trusting a client-supplied project identifier.

Existing chat memory actions are bridged into the governed Phase E candidate system so the older chat candidate path does not bypass Phase E governance.

## Security boundary

All Phase E server functions require authenticated Supabase sessions. Project and memory mutations are owner-checked server-side. RLS is enabled on Phase E tables. Storage is private. Candidate promotion and version replacement are restricted to service-role RPC execution after explicit actor ownership checks.

## Validation

Phase E adds contract tests covering:

- durable memory schema and scope rules;
- candidate/approved separation;
- bounded authorized retrieval;
- memory versioning and supersession;
- private project storage and ownership checks;
- legacy chat-candidate bridging.

The repository workflow runs the Phase E contract suite alongside the existing AAX, Phase D, web-intelligence, production-build, and Phase C type-validation checks.

## Deliberate boundaries

Phase E does **not** claim to complete the master plan's later Knowledge Curator/RAG work, native research hardening, report generation, scheduling, or the full ten-agent ecosystem. Those remain later workstreams. Phase E establishes the persistent memory/project substrate those systems will consume.
