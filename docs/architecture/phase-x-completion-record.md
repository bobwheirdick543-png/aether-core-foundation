# Phase X — Security Hardening

## Status

**Merged to `main`.** Phase X implementation is complete in the repository.

- Pull request: #21
- Squash merge commit: `f3aeb70137b1ff7ceac704f3d69775eacbf16adb`
- Phase X validation workflow: `34689205677` — successful

## Scope

Phase X hardens security across the Aether architecture without introducing a second execution or authorization system.

### Global security boundary

- Added `src/lib/aether/security-boundary.ts` for server-side authenticated identity, ownership, capability and privilege-escalation checks.
- Privileged/admin actions fail closed when the actor lacks the required role.
- Security denials are recorded through Phase W global observability.
- Security errors are sanitized before returning to API clients.
- Request payloads have an explicit server-side size boundary at the Developer API edge.

### Agent isolation

- Preserved the existing least-privilege `agentAllows` model.
- Hardened `security.ts` so denied agent actions can produce observable security events.
- Agents cannot self-grant permissions or roles.

### API security

- Developer API authentication continues to require active API keys and scopes.
- Caller-supplied project IDs are rechecked against the authenticated API-key owner before execution.
- Existing rate limiting and idempotency controls remain in place.

### Prompt/instruction security

- Added `untrusted-content.ts` to explicitly wrap web/file/connector/tool content as untrusted data.
- External content is bounded and model-facing formatting states that embedded instructions must not be executed.
- Role-like markers in external content remain data rather than becoming platform instructions.

### Architecture relationship

The security boundary follows the same platform path:

`Interface → Auth/Permissions → Cognitive Orchestrator → Model Router → Agents/Tools/Knowledge → Durable Task/Run → Worker → Result`

Security authorizes transitions; Phase W observability records the resulting facts. Database RLS and server authorization remain authoritative. No public product surface exposes the internal agent workforce merely because Phase X adds security controls.

## Validation

The Phase X workflow successfully completed:

1. Bun 1.2.21 installation
2. Dedicated security-boundary and untrusted-content tests
3. Phase A worker entrypoint validation
4. Development-mode production build

No new runtime dependency was introduced by Phase X.
