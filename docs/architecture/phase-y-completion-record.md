# Phase Y — Data Lifecycle & Reliability

## Scope

Phase Y extends the Aether architecture with durable lifecycle controls, recovery semantics and an independent Safety Bin ecosystem.

The implementation follows the existing execution path rather than creating a second platform runtime:

`Interface → Auth / Permissions → Cognitive Orchestrator → Model Router → Agents / Tools / Knowledge / Memory → Durable Task / Run → Worker → Result`

Phase X remains the authoritative authorization boundary and Phase W remains the global observability boundary. Safety Bin preservation sits across the data lifecycle boundary and records real deletion outcomes.

## Data lifecycle

- Retention policies are stored durably in `lifecycle_policies`.
- Retention execution is server-side through `apply_phase_y_retention`.
- Archive/soft-delete is preferred when the source table supports `archived`; otherwise configured deletion is used.
- Source deletion is intercepted by the Safety Bin before the row is destroyed.
- User export requests are persisted in `user_lifecycle_requests` and `export_user_data` returns authorized user-owned records.
- User deletion requests are persisted and require administrator processing. The deletion function removes the auth account only after authorization; public application rows are preserved first by the Safety Bin boundary.

## Safety Bin ecosystem

Safety Bin is an independent product subsystem, not a browser trash folder:

- `safety_bin_items` — canonical preserved deletion evidence.
- `safety_bin_versions` — immutable captured versions.
- `safety_bin_events` — chain-of-custody events.
- `safety_bin_restorations` — recovery outcomes.
- `safety_bin_exports` / `safety_bin_reports` — export/report provenance.
- `safety_bin_investigations` — governed investigation state.
- `safety_bin_purge_requests` — permanent-destruction workflow.
- `safety_bin_chat_messages` — Recycling Agent conversation history.

The database installs a `BEFORE DELETE` preservation boundary over existing public application tables. The capture records source table/object, owner, authenticated deleting actor, actor email where available, timestamp, original location, content hash, version and recovery state. Safety Bin metadata is explicitly excluded from its own capture trigger so permanent purge remains a separate operation.

## Recycling Agent

The canonical workforce now includes `recycling` / Recycling Agent. It has its own Safety Bin chat surface and operational tools for search, integrity, restoration, freezing and report generation.

The agent cannot:

- bypass Phase X authorization;
- change roles or permissions;
- self-escalate;
- permanently purge evidence;
- erase chain-of-custody history;
- inspect another user's private records without authorized access.

Permanent purge is administrator-only and is blocked for frozen evidence.

## Interface

The authenticated Aether shell now exposes a dedicated **♻️ Safety Bin** entry. On mobile it is a button directly below the hamburger navigation button. Selecting it opens `/safety-bin`, an independent ecosystem with Overview, Deleted Items, Recycling Agent, and Lifecycle & Export surfaces.

The Recycling Agent can answer operational queries such as identifying records attributed to a specific deleting email, and the Deleted Items surface supports search, selection, restore, evidence freeze and administrator-only permanent purge.

## Evidence reports

Selected Safety Bin records can be rendered into a dependency-free Aether-branded PDF containing report metadata, deletion attribution, timestamps, original location, integrity hash, recovery state and correlation identifiers. The generated artifact is stored in a private Supabase Storage bucket and returned only through a short-lived signed URL.

## Reliability boundaries

- Safety Bin capture is fail-closed: if evidence preservation fails, the source delete is aborted rather than silently bypassing the lifecycle boundary.
- Restore verifies the stored SHA-256 content hash before attempting reconstruction.
- Restore failures remain recorded and do not erase deletion history.
- Frozen evidence cannot be permanently purged through normal Safety Bin operations.
- Retention is bounded and server-side; Safety Bin evidence is not automatically aged out by the configured source retention policies.
- Export and deletion operations are authenticated and ownership/admin checked server-side.
- Real lifecycle events are observable through the existing Phase W telemetry boundary; no synthetic counts or activity are generated.

## Validation

Phase Y validation covers Safety Bin PDF/query primitives, migration contract checks, the existing application dependency installation, and the production build. Database-level destructive/recovery behavior is represented by repeatable SQL functions and must be exercised against the deployed Supabase database during operational rollout; the validation workflow does not fabricate a successful database restore.
