/**
 * AETHER CONTROLLED AGENT EXECUTOR
 *
 * Domain execution is invoked by the universal runtime worker. The executor
 * performs no queue management and cannot grant itself permissions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAgentBoundary } from "./security";
import { domainFromUrl, retrievePage, isHttpUrl } from "./research-engine";
import { runPlannedResearch, createResearchPlan } from "./research-planner";
import { persistAetherWebResearch, type AetherWebResearchResult } from "./aax-web-intelligence";
import { transitionRunStatus, transitionTaskStatus, appendTaskEvent } from "./task-service";
import { notifyTaskCompleted } from "./hooks";
import type { TaskStatus } from "./task-runtime";
import type { AgentResult } from "./agent-sdk";

function cancelledError() { return new DOMException("Research cancelled", "AbortError"); }

export async function executeResearchStep(
  admin: SupabaseClient,
  opts: {
    taskId: string;
    runId: string;
    ownerId: string;
    projectId?: string | null;
    urls: string[];
    topic?: string;
    deadlineAt?: string;
    workerId?: string;
  },
): Promise<AgentResult> {
  assertAgentBoundary("research", "web.search", { actorId: opts.ownerId, taskId: opts.taskId, runId: opts.runId });
  assertAgentBoundary("research", "research_sandbox.write", { actorId: opts.ownerId, taskId: opts.taskId, runId: opts.runId });

  const { data: task } = await admin.from("tasks").select("status, cancel_requested_at, deadline_at, project_id").eq("id", opts.taskId).single();
  const { data: run } = await admin.from("task_runs").select("status, cancel_requested_at, deadline_at").eq("id", opts.runId).single();
  if (!task || !run) throw new Error("Task or run not found");
  if (task.status !== "running" || run.status !== "running") throw new Error("Research run is not owned by an active runtime worker");

  const projectId = opts.projectId ?? task.project_id ?? null;
  const deadline = opts.deadlineAt ?? task.deadline_at ?? run.deadline_at ?? undefined;
  const isCancelled = () => Boolean(task.cancel_requested_at || run.cancel_requested_at || (deadline && new Date(deadline).getTime() <= Date.now()));
  if (isCancelled()) {
    await transitionRunStatus(admin, opts.runId, "running", "cancelled", { failureCode: "cancelled", retryable: false, workerId: opts.workerId });
    await transitionTaskStatus(admin, opts.taskId, "running", "cancelled", { workerId: opts.workerId });
    return { taskId: opts.taskId, runId: opts.runId, agentKey: "research", status: "cancelled", errors: [], timestamp: new Date().toISOString() };
  }

  // Topic research always uses the bounded native multi-source planner and the
  // universal runtime. This is the durable Phase F path that survives browser closure.
  if (opts.topic?.trim()) {
    const plan = createResearchPlan(opts.topic, "multi_source");
    await appendTaskEvent(admin, { taskId: opts.taskId, runId: opts.runId, eventType: "research.plan.started", message: "Native multi-source research plan started", data: { topic: plan.topic, query_count: plan.queries.length }, workerId: opts.workerId });
    const planned = await runPlannedResearch({ admin, ownerId: opts.ownerId, projectId, plan, taskId: opts.taskId, runId: opts.runId, signal: undefined });
    await appendTaskEvent(admin, { taskId: opts.taskId, runId: opts.runId, eventType: "research.plan.completed", message: "Native multi-source research plan completed", data: { session_id: planned.sessionId, source_count: planned.result.sources.length, domain_count: planned.result.sourceDomains.length, unmet_requirements: planned.unmetRequirements }, workerId: opts.workerId });
    const sources = planned.result.sources.map((source) => ({ url: source.url, title: source.title, domain: source.domain, retrievedAt: source.retrievedAt, publishedAt: source.publishedAt, sourceType: "web" as const, contentHash: source.contentHash, reliabilityHint: source.qualityScore }));
    const result: AgentResult = { taskId: opts.taskId, runId: opts.runId, agentKey: "research", status: "completed", result: { topic: opts.topic, research_session_id: planned.sessionId, source_count: sources.length, domain_count: planned.result.sourceDomains.length, unmet_requirements: planned.unmetRequirements, sources }, artifacts: sources.map((s) => ({ type: "source", path: s.url, title: s.title ?? undefined, metadata: { domain: s.domain, contentHash: s.contentHash } })), findings: [], warnings: planned.unmetRequirements, errors: [], confidence: sources.length ? Math.min(0.8, 0.3 + planned.result.diversity * 0.5) : 0, requiresReview: planned.unmetRequirements.length > 0, timestamp: new Date().toISOString(), metrics: { tool_calls: planned.result.sources.length, source_count: planned.result.sources.length, domain_count: planned.result.sourceDomains.length } };
    await transitionRunStatus(admin, opts.runId, "running", "completed", { outputs: result.result, workerId: opts.workerId });
    await transitionTaskStatus(admin, opts.taskId, "running", "completed", { progress: 100, detail: { phase: "native_research_complete", research_session_id: planned.sessionId }, workerId: opts.workerId });
    try { await notifyTaskCompleted(admin, { ownerId: opts.ownerId, taskId: opts.taskId, runId: opts.runId, title: `Research completed (${sources.length} sources)`, body: `Topic: ${opts.topic}`, eventType: "research.completed" }); } catch { /* notification failure does not change task truth */ }
    return result;
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
    const page = await retrievePage(url, { timeoutMs: Math.min(12000, remaining), maxBytes: 2_000_000, maxRedirects: 5, maxRetries: 2, respectRobots: true, signal: undefined });
    pages.push(page);
    await appendTaskEvent(admin, { taskId: opts.taskId, runId: opts.runId, eventType: page.error ? "tool.failed" : "tool.completed", message: page.error ? `Failed to fetch ${url}` : `Fetched ${url}`, data: { tool: "fetch_url", url, final_url: page.finalUrl, status: page.status, failure_class: page.failureClass, attempts: page.attempts }, workerId: opts.workerId });
  }

  const sourceObjects = pages.filter((p) => !p.error && p.status >= 200 && p.status < 400);
  const resultForPersistence: AetherWebResearchResult = { query: opts.topic ?? "direct URL research", sources: sourceObjects.map((p) => ({ url: p.finalUrl, canonicalUrl: p.canonicalUrl || p.finalUrl, title: p.title || p.finalUrl, domain: domainFromUrl(p.finalUrl), provider: "direct", snippet: p.description || "", text: p.text, status: p.status, contentHash: p.contentHash, retrievedAt: p.retrievedAt, publishedAt: p.publishedAt, updatedAt: p.updatedAt, author: p.author, headings: p.headings, links: p.links, encoding: p.encoding, parserVersion: p.parserVersion, parserWarnings: p.parserWarnings, contentType: p.contentType, contentLength: p.contentLength, redirectCount: p.redirectCount, attempts: p.attempts, stale: p.stale, staleReason: p.stale ? "source_date_older_than_policy" : null, qualityScore: undefined, qualityFactors: undefined })), failedSources: pages.filter((p) => p.error).map((p) => ({ url: p.url, provider: "direct", error: p.error || "Fetch failed", failureClass: p.failureClass })), sourceDomains: [...new Set(sourceObjects.map((p) => domainFromUrl(p.finalUrl)))], diversity: sourceObjects.length ? Math.min(1, new Set(sourceObjects.map((p) => domainFromUrl(p.finalUrl))).size / Math.min(5, sourceObjects.length)) : 0, completedAt: new Date().toISOString() };
  let researchSessionId: string | null = null;
  if (resultForPersistence.sources.length || resultForPersistence.failedSources.length) researchSessionId = await persistAetherWebResearch(admin, { ownerId: opts.ownerId, scope: "agent", query: resultForPersistence.query, result: resultForPersistence, taskId: opts.taskId, runId: opts.runId, projectId });

  const sources = sourceObjects.map((p) => ({ url: p.finalUrl, title: p.title, domain: domainFromUrl(p.finalUrl), retrievedAt: p.retrievedAt, publishedAt: p.publishedAt, sourceType: "web" as const, contentHash: p.contentHash, reliabilityHint: 0.5 }));
  const result: AgentResult = { taskId: opts.taskId, runId: opts.runId, agentKey: "research", status: sources.length > 0 ? "completed" : "failed", result: { topic: opts.topic ?? null, research_session_id: researchSessionId, source_count: sources.length, sources }, artifacts: sources.map((s) => ({ type: "source", path: s.url, title: s.title ?? undefined, metadata: { domain: s.domain, contentHash: s.contentHash } })), findings: [], warnings: pages.filter((p) => p.error).map((p) => `${p.url}: ${p.error}`), errors: sources.length === 0 && safeUrls.length > 0 ? ["No pages could be retrieved"] : [], confidence: sources.length > 0 ? 0.5 : 0, requiresReview: false, timestamp: new Date().toISOString(), metrics: { tool_calls: safeUrls.length } };

  const finalStatus: TaskStatus = result.status === "completed" ? "completed" : "failed";
  await transitionRunStatus(admin, opts.runId, "running", finalStatus, { outputs: result.result, error: result.errors?.[0], failureCode: finalStatus === "failed" ? "research_no_sources" : undefined, retryable: finalStatus === "failed", workerId: opts.workerId });
  await transitionTaskStatus(admin, opts.taskId, "running", finalStatus, { progress: finalStatus === "completed" ? 100 : 0, workerId: opts.workerId });
  try { await notifyTaskCompleted(admin, { ownerId: opts.ownerId, taskId: opts.taskId, runId: opts.runId, title: finalStatus === "completed" ? `Research completed (${sources.length} sources)` : "Research failed", body: opts.topic ? `Topic: ${opts.topic}` : undefined, eventType: finalStatus === "completed" ? "research.completed" : "task.failed" }); } catch { /* notification failure is independent of task truth */ }
  return result;
}
