# Aether web search runtime

Aether knowledge acquisition uses a server-only Exa Search API credential.

Set:

`EXA_API_KEY=<server-side secret>`

Never put the value in client code, VITE_* variables, git, database rows intended for the browser, logs, task events, or prompts.

The shared server boundary is `src/lib/aether/web-search.server.ts`. Agents call that boundary rather than embedding provider authentication.

Knowledge acquisition intentionally fails closed when `EXA_API_KEY` is missing. This prevents a knowledge task from silently claiming Exa-backed research while using an unintended provider.

The search implementation follows Exa's current Search API contract: POST `https://api.exa.ai/search`, Bearer authentication, `type: "auto"` by default, and nested `contents.highlights` / `contents.text`.

The credential supplied during development must be rotated if it was exposed in chat or source control.
