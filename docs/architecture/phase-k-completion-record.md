# Phase K — Notification & Delivery Agent

Status: **COMPLETE**

Phase K extends the architecture boundary:

`Tasks / Research / Verification / Knowledge / Reports → Notification & Delivery → recipient channels`

The agent is a governed delivery boundary. It consumes durable platform events and report/task state; it does not invent events, change ownership, publish knowledge, bypass authorization, or expose private artifacts. Recipient ownership is revalidated before notification creation and delivery queueing.

## Delivered

- Durable notification preferences for in-app and email channels.
- Explicit notification event taxonomy and stable in-app action links.
- Provider-independent delivery primitives with email normalization/validation, bounded retry backoff and delivery idempotency keys.
- Durable `notification_deliveries` queue state with attempts, errors, scheduling and sent timestamps.
- Server-authoritative creation, queueing, preference updates and administrator-only pending-delivery processing.
- Cross-user resource protection and administrator audience checks.
- Private report links remain relative application links; Phase J signed URLs are still minted only by the report authorization boundary.
- Existing notification inbox remains the user-facing read surface.
- No email provider or secret was fabricated; provider-backed email delivery remains pending until a configured provider/worker is supplied.

## Architecture relationship

Phase K sits after durable work/report state and before external delivery. Phase J remains responsible for report artifact authorization. Phase K may notify that a report is ready but cannot mint or expose private storage URLs. Future Phase L durable scheduling/workers can execute pending delivery queue items independently of an open browser.

## Validation

Focused Phase K TypeScript validation, notification delivery regression tests and production build are required before closure. Vercel is not used for validation or deployment.
