import { searchWeb, type WebSearchRequest, type WebSearchResult } from "./web-search.server";
import { authorizeAgentAction } from "./agent-runtime";
import type { AgentKey } from "./agents";

export type AgentWebSearchInput = WebSearchRequest & {
  agentKey: AgentKey;
  actorId?: string | null;
  taskId?: string | null;
  runId?: string | null;
};

export async function searchWebForAgent(input: AgentWebSearchInput): Promise<WebSearchResult> {
  const authorization = await authorizeAgentAction({
    agentKey: input.agentKey,
    permission: "web.search",
    action: "web.search",
    taskId: input.taskId ?? null,
    runId: input.runId ?? null,
    actorId: input.actorId ?? null,
    metadata: {
      queryLength: input.query.length,
      searchType: input.type ?? "auto",
      requestedResults: input.numResults ?? 8,
    },
  });
  if (!authorization.allowed) {
    throw new Error("reason" in authorization ? authorization.reason : "Web search authorization denied");
  }
  return searchWeb(input);
}
