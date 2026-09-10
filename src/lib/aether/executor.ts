/**
 * AETHER CONTROLLED AGENT EXECUTOR
 *
 * Domain execution is invoked by the universal runtime worker. The executor
 * performs no queue management and cannot grant itself permissions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAgentBoundary } from "./security";
import { retrievePage, toSourceMeta, isHttpUrl } from "./research-engine";
import { transitionRunStatus, transitionTaskStatus, appendTaskEvent } from "./task-service";
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
    deadlineAt?: string;
    workerId?: string;
  },
): Promise<AgentResult> {
  assertAgentBoundary("research", "web.search", { actorId: opts.ownerId, taskId: opts.taskId, runId: opts.runId });
  assertAgentBoundary("research", "research_sandbox.write", { actorId: opts.ownerId, taskId: opts.taskId, runId: opts.runId });

  const { data: task } = await admin.from("tasks").select("status, cancel_requested_at, deadline_at").eq("id", opts.taskId).single();
  const { data: run } = await admin.from("task_runs").select("status, cancel_requested_at, deadline_at").eq("id", opts.runId).single();
  if (!task || !run) throw new Error("Task or run not found");
  if (task.status !== "running" || run.status !== "running") throw new Error("Research run is not owned by an active runtime worker");

  const deadline = opts.deadlineAt ?? task.deadline_at ?? run.deadline_at ?? undefined;
  const cancelled = Boolean(task.cancel_requested_at || run.cancel_requested_at || (deadline && new Date(deadline).getTime() <= Date.now()));
  if (cancelled) {
    await transitionRunStatus(admin, opts.runId, "running", "cancelled", { failureCode: "cancelled", retryable: false, workerId: opts.workerId });
    await transitionTaskStatus(admin, opts.taskId, "running", "cancelled", { workerId: opts.workerId });
    return { taskId: opts.taskId, runId: opts.runId, agentKey: "research", status: "cancelled", errors: [], timestamp: new Date().toISOString() };
  }

  const safeUrls = opts.urls.filter((u) => isHttpUrl(u)).slice(0, 10);
  const pages = [];
  for (const url of safeUrls) {
    const current = await admin.from("tasks").select("cancel_requested_at, deadline_at").eq("id", opts.taskId).single();
    if (current.data?.cancel_requested_at || (current.data?.deadline_at && new Date(current.data.deadline_at).getTime() <= Date.now())) {
      await transitionRunStatus(admin, opts.runId, "running", "cancelled", { failureCode: "cancelled", retryable: false, workerId: opts.workerId });
      await transitionTaskStatus(admin, opts.taskId, "running", "cancelled", { workerId: opts.workerId });
      return { taskId: opts.taskId, runId: opts.runId, agentKey: "research", status: "cancelled", timestamp: new Date().toISOString() };
    }
    const remaining = deadline ? Math.max(1000, new Date(deadline).getTime() - Date.now()) : 12000;
    pages.push(await retrievePage(url, Math.min(12000, remaining)));
    await appendTaskEvent(admin, { taskId: opts.taskId, runId: opts.runId, eventType: "tool.completed", message: `Fetched ${url}`, data: { tool: "fetch_url", url }, workerId: opts.workerId });
  }

  const sources = pages.filter((p) => !p.error && p.status >= 200 && p.status < 400).map(toSourceMeta);
  const result: AgentResult = {
    taskId: opts.taskId, runId: opts.runId, agentKey: "research",
    status: sources.length > 0 ? "completed" : "failed",
    result: { topic: opts.topic ?? null, source_count: sources.length, sources },
    artifacts: sources.map((s) => ({ type: "source", path: s.url, title: s.title ?? undefined, metadata: { domain: s.domain, contentHash: s.contentHash } })),
    findings: [],
    warnings: pages.filter((p) => p.error).map((p) => `${p.url}: ${p.error}`),
    errors: sources.length === 0 && safeUrls.length > 0 ? ["No pages could be retrieved"] : [],
    confidence: sources.length > 0 ? 0.5 : 0,
    requiresReview: false,
    timestamp: new Date().toISOString(),
    metrics: { tool_calls: safeUrls.length },
  };

  const finalStatus: TaskStatus = result.status === "completed" ? "completed" : "failed";
  await transitionRunStatus(admin, opts.runId, "running", finalStatus, {
    outputs: result.result, error: result.errors?.[0], failureCode: finalStatus === "failed" ? "research_no_sources" : undefined,
    retryable: finalStatus === "failed", workerId: opts.workerId,
  });
  await transitionTaskStatus(admin, opts.taskId, "running", finalStatus, { progress: finalStatus === "completed" ? 100 : 0, workerId: opts.workerId });

  try {
    await notifyTaskCompleted(admin, { ownerId: opts.ownerId, taskId: opts.taskId, runId: opts.runId,
      title: finalStatus === "completed" ? `Research completed (${sources.length} sources)` : "Research failed",
      body: opts.topic ? `Topic: ${opts.topic}` : undefined, eventType: finalStatus === "completed" ? "research.completed" : "task.failed" });
  } catch { /* notification failure is independent of task truth */ }
  return result;
}
