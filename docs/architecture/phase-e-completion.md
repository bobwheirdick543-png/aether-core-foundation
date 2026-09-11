# Phase E Completion Gate

Phase E closes the Master Plan's Memory + Projects workstream.

## Memory

- Short-term conversation context is bounded by a 40-message history limit and a 120,000-character budget.
- Long-term memory is explicit, owned, scoped and visible to the user.
- Global and project memory are isolated by authenticated owner and project ownership.
- Retrieval is ranked using lexical relevance, importance, confidence and freshness, with a minimum relevance threshold of 0.12 and a maximum of 20 injected memories.
- Provenance is retained for source conversation/message/task, reason, confidence, version and retrieval events.
- Users can inspect, edit, delete and disable memory, and can export a complete JSON package of memories, candidates and provenance events.
- Candidate memory is separate from production memory and requires explicit promotion.
- Sensitive credentials, recovery secrets, OTPs and payment-card content are classified as ineligible for automatic durable persistence.
- Deleted and superseded memories are excluded from retrieval while their audit history remains available.

## Evaluation

The Phase E test suite covers:

- relevance scoring and threshold behavior;
- stale-memory detection;
- explicit contradiction detection;
- deleted-memory exclusion;
- bounded short-term context;
- sensitive-content persistence protection;
- authenticated export;
- project/ownership/security contracts from the existing Phase E suite.

## Verification boundary

The repository CI workflow is configured to run the Phase E completion tests together with the existing AAX and Phase D tests and the production build/type-validation steps. A GitHub Actions result must still be observed after the current push before claiming the CI run itself is green.
