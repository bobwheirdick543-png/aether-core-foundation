# Aether web search runtime

Aether knowledge acquisition uses a server-only Exa Search API credential.

Set:

`EXA_API_KEY=<server-side secret>`

Never put the value in client code, VITE_* variables, git, database rows intended for the browser, logs, task events, or prompts.

The shared server boundary is `src/lib/aether/web-search.server.ts`. Agents call that boundary rather than embedding provider authentication.

Knowledge acquisition intentionally fails closed when `EXA_API_KEY` is missing. This prevents a knowledge task from silently claiming Exa-backed research while using an unintended provider.

The search implementation follows Exa's current Search API contract: POST `https://api.exa.ai/search`, Bearer authentication, `type: "auto"` by default, and nested `contents.highlights` / `contents.text`.

The credential supplied during development must be rotated if it was exposed in chat or source control.

## Number 19 — one shared search capability

Every Aether agent that performs live-web research uses the same server-side search boundary:

`searchWebForAgent()` → agent authorization/audit → `searchWeb()` → Exa Search API.

Applicable live-research agents are:
- Research Agent
- Verification Agent
- Knowledge Acquisition Agent
- Knowledge Curator
- Security & Compliance Agent
- Orchestrator is kept as a coordinator only and does not receive direct web-search access.

Agent research is forced to the centralized Exa provider. Agent-specific provider keys and direct provider authentication are not supported.

The same boundary is used for:
- native research tasks
- knowledge acquisition
- AAX knowledge evolution from PDFs/documents/manual knowledge
- AAX native web research
- verification/security research passes
- future agents granted the durable `web.search` capability

Authorization is enforced through the durable agent permission registry and every authorized search produces an agent-action audit record. Search request context may carry the authenticated actor, task, and run identifiers so the research remains attributable and persistent.

The Exa credential is never placed in agent prompts, client bundles, task data, or database records. Configure only the server deployment secret `EXA_API_KEY`.

## Exa Search API contract

The shared boundary follows Exa's current Search API reference:
- POST https://api.exa.ai/search
- Authorization: Bearer $EXA_API_KEY
- type: auto, fast, instant, deep-lite, deep, or deep-reasoning
- numResults: 1–100
- contents.highlights and bounded contents.text for agent workflows
- contents.maxAgeHours: 0 for explicitly fresh/live retrieval
- current domain/date/category filter names
- outputSchema, systemPrompt, additionalQueries, subpage crawling, and extracted links are supported by the server boundary
- deprecated parameters such as useAutoprompt, includeUrls, excludeUrls, top-level text/summary/highlights, numSentences, highlightsPerUrl, and livecrawl are not used

The implementation intentionally keeps JSON search as the agent contract. Exa's streaming/SSE response mode is not exposed to agents until a dedicated streaming parser is added; this prevents an agent from treating an SSE response as a normal JSON result.

Every authorized agent search records durable telemetry containing agent/task/run ownership, provider, search type, result count, latency, cost when supplied by Exa, and a non-reversible query fingerprint. Raw provider credentials and raw search queries are not stored in telemetry.

The current Exa reference was reviewed on September 19, 2026. Exa documents auto as the normal default, highlights as the preferred mode for multi-step agent workflows, and maxAgeHours: 0 for forced livecrawl.