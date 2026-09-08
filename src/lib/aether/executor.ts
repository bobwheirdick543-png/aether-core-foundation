/**
 * AETHER CONTROLLED AGENT EXECUTOR
 *
 * Advances a single run step under strict permission and ownership checks.
 * Currently implements the Research retrieval step only.
 * No external AI. No fabricated findings. Browser-independent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAgentBoundary } from "./security";
import { retrievePage, toSourceMeta, isHttpUrl } from "./research-engine";
import { transitionRunStatus, transitionTaskStatus } from "./task-service";
import { notifyTaskCompleted } from "./hooks";
import type { TaskStatus } from "./task-runtime";
import type { AgentResult } from "./agent-sdk";

export async function executeResearchStep(
  admin: SupabaseClient,
  opts: {
    taskId: string;
    runId: string;
    ownerId: string;
    urls: string[];
    topic?: string;
  },
): Promise<AgentResult> {
  // Permission boundary
  assertAgentBoundary("research", "web.search", {
    actorId: opts.ownerId,
    taskId: opts.taskId,
    runId: opts.runId,
  });
  assertAgentBoundary("research", "research_sandbox.write", {
    actorId: opts.ownerId,
    taskId: opts.taskId,
    runId: opts.runId,
  });

  // Mark run running
  await transitionRunStatus(admin, opts.runId, "queued", "running");
  await transitionTaskStatus(admin, opts.taskId, "queued", "running", { progress: 10 });

  const safeUrls = opts.urls.filter((u) => isHttpUrl(u)).slice(0, 10);
  const pages = [];
  for (const url of safeUrls) {
    pages.push(await retrievePage(url));
  }

  const sources = pages
    .filter((p) => !p.error && p.status >= 200 && p.status < 400)
    .map(toSourceMeta);

  const result: AgentResult = {
    taskId: opts.taskId,
    runId: opts.runId,
    agentKey: "research",
    status: sources.length > 0 ? "completed" : "failed",
    result: {
      topic: opts.topic ?? null,
      source_count: sources.length,
      sources,
    },
    artifacts: sources.map((s) => ({
      type: "source",
      path: s.url,
      title: s.title ?? undefined,
      metadata: { domain: s.domain, contentHash: s.contentHash },
    })),
    findings: [], // deliberately empty — no fabricated claims
    warnings: pages.filter((p) => p.error).map((p) => `${p.url}: ${p.error}`),
    errors: sources.length === 0 && safeUrls.length > 0 ? ["No pages could be retrieved"] : [],
    confidence: sources.length > 0 ? 0.5 : 0,
    requiresReview: false,
    timestamp: new Date().toISOString(),
    metrics: {
      tool_calls: safeUrls.length,
      duration_ms: 0,
    },
  };

  const finalStatus: TaskStatus = result.status === "completed" ? "completed" : "failed";

  await transitionRunStatus(admin, opts.runId, "running", finalStatus, {
    outputs: result.result,
    error: result.errors?.[0],
  });
  await transitionTaskStatus(admin, opts.taskId, "running", finalStatus, {
    progress: finalStatus === "completed" ? 100 : 0,
  });

  // Ownership-safe notification
  try {
    await notifyTaskCompleted(admin, {
      ownerId: opts.ownerId,
      taskId: opts.taskId,
      runId: opts.runId,
      title:
        finalStatus === "completed"
          ? `Research completed (${sources.length} sources)`
          : "Research failed",
      body: opts.topic ? `Topic: ${opts.topic}` : undefined,
      eventType: finalStatus === "completed" ? "research.completed" : "task.failed",
    });
  } catch {
    // notification failure must not roll back the run
  }

  return result;
}
