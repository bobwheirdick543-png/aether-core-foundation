# Phase S Implementation Work Log

Implementation is being performed against the existing Aether architecture. Changes must preserve the established Phase A durable runtime, Phase N orchestration, Phase M bounded-agent controls, Phase O authorization/security, Phase Q module runtime, Phase K notifications, and Phase W observability boundaries.

## Working principles

1. No parallel runtime or second task queue.
2. Developer API authentication remains separate from provider/model credentials.
3. API keys are never persisted in plaintext.
4. Every resource is owner/project scoped before domain access.
5. Sensitive operations pass through the existing security decision boundary.
6. Public API behavior is versioned under `/api/v1/`.
7. Mutating requests must be replay-safe where an idempotency key is supplied.
8. Request correlation must survive from HTTP ingress through audit logging.
9. Documentation and SDK must describe only behavior that the runtime actually supports.
10. Completion is declared only after focused validation succeeds.
