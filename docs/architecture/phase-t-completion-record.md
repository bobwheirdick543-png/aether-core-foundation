# Phase T — Complete Website Product Surface

Phase T completes the user-facing Aether website surface without exposing internal implementation details that ordinary users do not need to know.

## Product contract

- Public marketing presents Aether as a unified AI platform and uses **Aether Ascension (AAX)** as the visible model-family identity.
- Internal agent/runtime architecture remains behind the product boundary and is not advertised in the public landing navigation or landing page.
- Authenticated users receive a first-run onboarding flow for identity, preferred language, AAX preference, response style, memory preference, and an optional first project.
- Onboarding state is persisted on the user's `profiles` record and enforced at the authenticated route boundary.
- Existing project, memory, knowledge, research, reports, tasks, API and settings surfaces remain connected to their existing backend services rather than being replaced with local-only UI.
- The root route supplies shared not-found and error recovery states; existing authenticated pages retain their route-level loading, empty and error handling.

## Architecture alignment

Website → Aether backend/API → authentication + permissions → Cognitive Orchestrator → AAX model routing → memory/projects/approved knowledge/retrieval → tools/agents/modules → durable tasks/workers → reports/storage/audit/observability.

Phase T changes are presentation and product-flow work on top of that architecture. Internal agents remain implementation components and are not part of the ordinary public marketing contract.

## AAX branding

Public and authenticated model-facing surfaces use **Aether Ascension / AAX** terminology. The website does not present unrelated provider model brands as Aether's product identity.

## Validation

The Phase T validation workflow checks:

1. The public landing page does not advertise internal agents.
2. The repository typechecks with TypeScript.
3. The development production build completes successfully.

Phase T should only be marked operationally complete when the validation workflow is green on the merge commit and no existing user-facing functionality has been regressed.
