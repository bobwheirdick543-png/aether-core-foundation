# Phase S Implementation Gap Register

This register tracks implementation gaps found by the independent Phase S audit.

| Area | Required behavior | Current audit status |
|---|---|---|
| API keys | Issue, hash, prefix, expiry, revoke, rotate | Implemented |
| Authentication | Bearer API-key authentication backed by durable records | Implemented |
| Scopes | Server-side scope enforcement | Implemented, but coverage must match every advertised endpoint |
| Rate limiting | Durable per-key request limiting | Implemented |
| Audit | Durable request/key lifecycle events | Implemented, completeness must be verified |
| Request IDs | Stable request correlation across response/log/runtime | Needs completion |
| Idempotency | Replay-safe mutation semantics | Needs completion |
| Projects | Read/write ownership-bound API | Implemented |
| Tasks/runs | Durable Task → Run integration | Implemented |
| Chat | Developer API access to existing chat runtime | Needs verification/completion |
| Model routing | Developer API access to existing routing boundary | Missing/incomplete in inspected handler |
| Knowledge | Developer API access with correct read/write semantics | Needs completion/verification |
| Research | Developer API access with correct read/write semantics | Needs completion/verification |
| Files | Developer API access to existing file boundary | Missing/incomplete in inspected handler |
| Reports | Developer API access | Implemented read surface; write behavior depends on specification |
| Modules | Read/write semantics | Scope exists; write handler coverage needs completion |
| Battleversia | Read/write semantics | Scope exists; inspected handler is primarily read-oriented |
| Webhooks | Durable registration and delivery | Present in project; requires end-to-end verification |
| Usage | Actual request/usage metrics and dashboard | Needs completion/verification |
| Errors | Consistent structured JSON error contract | Needs normalization across all failure paths |
| SDK | Matches actual API contract | Present; must remain synchronized with final routes |
| Documentation | Accurate versioned API reference/examples | Present; must be updated with final contract |
| Security | Phase O decision before protected operations | Present in architecture; must be verified for every sensitive route |

The register is deliberately conservative: an item is not considered complete merely because a type, scope, documentation entry, or database object exists.
