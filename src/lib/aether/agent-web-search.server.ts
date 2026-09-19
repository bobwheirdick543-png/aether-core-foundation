import { createHash } from "node:crypto";
import { searchWeb, type WebSearchRequest, type WebSearchResult } from "./web-search.server";
import { authorizeAgentAction } from "./agent-runtime";
import type { AgentKey } from "./agents";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AgentWebSearchInput = WebSearchRequest & {
  agentKey: AgentKey;
  actorId?: string | null;
  taskId?: string | null;
  runId?: string | null;
};

function queryFingerprint(query: string): string {
  return createHash("sha256").update(query.trim()).digest("hex").slice(0, 16);
}

async function persistSearchTelemetry(input: AgentWebSearchInput, result: WebSearchResult): Promise<void> {
  const { error } = await supabaseAdmin.from("aether_web_search_requests").insert({
    request_id: result.requestId,
    agent_key: input.agentKey,
    actor_id: input.actorId ?? null,
    task_id: input.taskId ?? null,
    run_id: input.runId ?? null,
    provider: "exa",
    query_fingerprint: queryFingerprint(input.query),
    search_type: result.searchType,
    result_count: result.results.length,
    latency_ms: result.latencyMs,
    cost_dollars: result.costDollars ?? null,
    status: "completed",
  });
  if (error) throw new Error(`Web search completed but telemetry persistence failed: ${error.message}`);
}

async function persistSearchFailure(input: AgentWebSearchInput, error: unknown): Promise<void> {
  const providerError = error instanceof Error ? error.message : String(error);
  await supabaseAdmin.from("aether_web_search_requests").insert({
    request_id: null,
    agent_key: input.agentKey,
    actor_id: input.actorId ?? null,
    task_id: input.taskId ?? null,
    run_id: input.runId ?? null,
    provider: "exa",
    query_fingerprint: queryFingerprint(input.query),
    search_type: input.type ?? "auto",
    result_count: 0,
    latency_ms: null,
    cost_dollars: null,
    status: "failed",
    error_message: providerError.slice(0, 1000),
  });
}

export async function searchWebForAgent(input: AgentWebSearchInput): Promise<WebSearchResult> {
  const authorization = await authorizeAgentAction({
    agentKey: input.agentKey,
    permission: "web.search",
    action: "web.search",
    taskId: input.taskId ?? null,
    runId: input.runId ?? null,
    actorId: input.actorId ?? null,
    metadata: {
      provider: "exa",
      queryLength: input.query.length,
      queryFingerprint: queryFingerprint(input.query),
      searchType: input.type ?? "auto",
      requestedResults: input.numResults ?? 8,
    },
  });
  if (!authorization.allowed) {
    throw new Error("reason" in authorization ? authorization.reason : "Web search authorization denied");
  }

  try {
    const result = await searchWeb(input);
    await persistSearchTelemetry(input, result);
    return result;
  } catch (error) {
    await persistSearchFailure(input, error).catch(() => undefined);
    throw error;
  }
}
