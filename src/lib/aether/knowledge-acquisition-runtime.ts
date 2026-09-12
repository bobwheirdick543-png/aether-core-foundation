import type { SupabaseClient } from "@supabase/supabase-js";
import { createTask, createRun, appendTaskEvent, transitionRunStatus, transitionTaskStatus } from "./task-service";
import { assertAgentBoundary } from "./security";
import { createResearchPlan, runPlannedResearch, compareResearchSources } from "./research-planner";
import { extractKnowledge, findConflicts, freshnessFromEvidence, mergeFreshness } from "./knowledge-curator-engine";
import { normalizeUrl } from "./research-engine";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const KNOWLEDGE_RESEARCH_DEFAULT_MS = 15 * 60 * 1000;
export const KNOWLEDGE_RESEARCH_MIN_MS = 5 * 60 * 1000;
export const KNOWLEDGE_RESEARCH_MAX_MS = 60 * 60 * 1000;

export type KnowledgeTarget = "agent" | "model" | "models" | "global";
export type KnowledgeSourceType = "background" | "user" | "admin" | "url" | "github" | "document" | "prompt" | "image";

export interface BoundedKnowledgeScope {
  core: string[];
  essentialContext: string[];
  relevantRelationships: string[];
  terminology: string[];
  verification: string[];
  exclusions: string[];
}

export function normalizeResearchBudget(value?: number): number {
  if (!Number.isFinite(value)) return KNOWLEDGE_RESEARCH_DEFAULT_MS;
  return Math.min(KNOWLEDGE_RESEARCH_MAX_MS, Math.max(KNOWLEDGE_RESEARCH_MIN_MS, Math.floor(value!)));
}

export function buildBoundedKnowledgeScope(subject: string): BoundedKnowledgeScope {
  const s = subject.trim().slice(0, 300);
  return {
    core: [
      `${s} identity and defining characteristics`,
      `${s} history, origin and major developments`,
      `${s} capabilities, products, properties or major works`,
      `${s} limitations, weaknesses, constraints or known exceptions`,
    ],
    essentialContext: [
      `${s} essential surrounding context required to understand the subject`,
      `${s} important organizations, settings, technologies, people or concepts directly connected to it`,
    ],
    relevantRelationships: [
      `${s} important relationships and affiliations`,
      `${s} major related events or concepts only where they materially explain the subject`,
    ],
    terminology: [
      `important terminology and definitions needed to understand ${s}`,
    ],
    verification: [
      `cross-source agreement, conflicts, dates, source quality and unresolved claims about ${s}`,
    ],
    exclusions: [
      `unrelated domains`,
      `recursive expansion that is not necessary to satisfy the ${s} objective`,
      `a complete study of a parent universe, franchise, industry or neighboring subject unless required for context`,
    ],
  };
}

export function boundedResearchQueries(subject: string): string[] {
  const clean = subject.trim().slice(0, 300);
  return [
    clean,
    `${clean} history origin major developments`,
    `${clean} capabilities products properties major works`,
    `${clean} essential context relationships affiliations`,
    `${clean} terminology definitions evidence`,
    `${clean} verification authoritative sources recent updates`,
  ];
}

function dedupeKey(subject: string, scope: BoundedKnowledgeScope, target: KnowledgeTarget, modelKeys: string[]): string {
  const normalized = `${subject.trim().toLowerCase()}|${target}|${modelKeys.slice().sort().join(",")}|${JSON.stringify(scope)}`;
  return `ka:${normalized.replace(/[^a-z0-9|,\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 900)}`;
}

export async function createKnowledgeAcquisitionTask(admin: SupabaseClient, input: {
  ownerId: string;
  subject: string;
  title?: string;
  projectId?: string | null;
  sourceType?: KnowledgeSourceType;
  targetType?: KnowledgeTarget;
  targetModelKeys?: string[];
  timeBudgetMs?: number;
  priority?: number;
  trigger?: string;
}): Promise<{ taskId: string; runId: string; jobId: string; deduplicated: boolean }> {
  const subject = input.subject.trim().slice(0, 300);
  if (subject.length < 3) throw new Error("Knowledge acquisition subject is required");
  const scope = buildBoundedKnowledgeScope(subject);
  const targetType = input.targetType ?? "global";
  const targetModelKeys = [...new Set((input.targetModelKeys ?? []).map((v) => v.trim()).filter(Boolean))].slice(0, 20);
  const timeBudgetMs = normalizeResearchBudget(input.timeBudgetMs);
  const key = dedupeKey(subject, scope, targetType, targetModelKeys);
  const { data: existing } = await admin.from("aether_knowledge_acquisition_jobs").select("id,task_id,run_id,status").eq("dedupe_key", key).in("status", ["queued", "running", "paused", "waiting_approval"]).maybeSingle();
  if (existing) return { taskId: existing.task_id, runId: existing.run_id, jobId: existing.id, deduplicated: true };
  const task = await createTask(admin, {
    owner_id: input.ownerId,
    project_id: input.projectId ?? null,
    title: input.title?.trim().slice(0, 160) || `Knowledge acquisition: ${subject}`,
    kind: "knowledge-acquisition",
    status: "queued",
    priority: input.priority ?? 0,
    timeout_ms: timeBudgetMs,
    detail: {
      subject,
      scope,
      depth_tier: "A",
      time_budget_ms: timeBudgetMs,
      target_type: targetType,
      target_model_keys: targetModelKeys,
      source_type: input.sourceType ?? "background",
      trigger: input.trigger ?? "background_knowledge_gap",
      queries: boundedResearchQueries(subject),
    },
    idempotency_key: key,
  });
  const run = await createRun(admin, {
    task_id: task.id,
    owner_id: input.ownerId,
    agent_key: "knowledge-acquisition",
    inputs: { subject, scope, target_type: targetType, target_model_keys: targetModelKeys },
    timeout_ms: timeBudgetMs,
    idempotency_key: `${key}:run`,
  });
  const { data: job, error } = await admin.from("aether_knowledge_acquisition_jobs").insert({
    task_id: task.id,
    run_id: run.id,
    owner_id: input.ownerId,
    project_id: input.projectId ?? null,
    title: input.title?.trim().slice(0, 160) || `Knowledge acquisition: ${subject}`,
    subject,
    scope,
    depth_tier: "A",
    time_budget_ms: timeBudgetMs,
    target_type: targetType,
    target_model_keys: targetModelKeys,
    source_type: input.sourceType ?? "background",
    dedupe_key: key,
    status: "queued",
    last_event_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !job) {
    await admin.from("tasks").update({ status: "failed", last_error_code: "knowledge_job_create_failed", last_error_message: error?.message ?? "Could not create knowledge acquisition job" }).eq("id", task.id);
    throw new Error(error?.message ?? "Could not create knowledge acquisition job");
  }
  await appendTaskEvent(admin, { taskId: task.id, runId: run.id, eventType: "knowledge_acquisition.queued", message: "Bounded knowledge acquisition queued", data: { subject, time_budget_ms: timeBudgetMs, target_type: targetType, trigger: input.trigger ?? "background_knowledge_gap" }, actorId: input.ownerId });
  return { taskId: task.id, runId: run.id, jobId: job.id, deduplicated: false };
}

function sourceMetadata(source: any): Record<string, unknown> {
  return { sourceId: source.id, url: source.url, canonicalUrl: source.canonical_url, title: source.title, domain: source.domain, retrievedAt: source.retrieved_at, publishedAt: source.published_at, updatedAt: source.updated_at_source, qualityScore: source.quality_score, staleAt: source.stale_at };
}

export async function executeKnowledgeAcquisitionStep(admin: SupabaseClient, opts: { taskId: string; runId: string; ownerId: string; projectId?: string | null; deadlineAt?: string | null; workerId?: string | null }): Promise<void> {
  assertAgentBoundary("knowledge-acquisition", "web.search", { actorId: opts.ownerId, taskId: opts.taskId, runId: opts.runId });
  const { data: job, error: jobError } = await admin.from("aether_knowledge_acquisition_jobs").select("*").eq("task_id", opts.taskId).eq("run_id", opts.runId).maybeSingle();
  if (jobError || !job) throw new Error(jobError?.message ?? "Knowledge acquisition job not found");
  const deadline = opts.deadlineAt ?? new Date(Date.now() + Number(job.time_budget_ms)).toISOString();
  const controller = new AbortController();
  const timer = setInterval(() => {
    void (async () => {
      const [{ data: task }, { data: run }] = await Promise.all([
        admin.from("tasks").select("cancel_requested_at,deadline_at,status").eq("id", opts.taskId).maybeSingle(),
        admin.from("task_runs").select("cancel_requested_at,deadline_at,status").eq("id", opts.runId).maybeSingle(),
      ]);
      if (task?.cancel_requested_at || run?.cancel_requested_at || task?.status === "cancelled" || run?.status === "cancelled" || Date.now() >= new Date(task?.deadline_at ?? run?.deadline_at ?? deadline).getTime()) controller.abort();
    })().catch(() => undefined);
  }, 1500);
  try {
    await admin.from("aether_knowledge_acquisition_jobs").update({ status: "running", started_at: job.started_at ?? new Date().toISOString(), last_event_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", job.id);
    const scope = job.scope as BoundedKnowledgeScope;
    await appendTaskEvent(admin, { taskId: opts.taskId, runId: opts.runId, eventType: "knowledge.scope.created", message: "Bounded acquisition scope created", data: { scope, time_budget_ms: job.time_budget_ms, depth_tier: job.depth_tier }, workerId: opts.workerId });
    const plan = createResearchPlan(job.subject, "multi_source");
    plan.queries = boundedResearchQueries(job.subject);
    plan.sourceRequirements = { minSources: 5, minDomains: 3, preferredProviders: ["official", "government", "academic", "wikipedia", "duckduckgo"] };
    await appendTaskEvent(admin, { taskId: opts.taskId, runId: opts.runId, eventType: "knowledge.research.started", message: "Bounded multi-source research started", data: { query_count: plan.queries.length, scope_tier: job.depth_tier }, workerId: opts.workerId });
    const planned = await runPlannedResearch({ admin, ownerId: opts.ownerId, projectId: opts.projectId, plan, taskId: opts.taskId, runId: opts.runId, signal: controller.signal });
    if (controller.signal.aborted) throw new DOMException("Knowledge acquisition cancelled or timed out", "AbortError");
    const sources = planned.result.sources ?? [];
    const sourceIds = sources.map((s: any) => s.id).filter(Boolean);
    const comparison = compareResearchSources(job.subject, sources.map((s: any) => ({ id: String(s.id ?? s.contentHash ?? s.url), url: s.url, title: s.title, content: s.text, publishedAt: s.publishedAt, updatedAt: s.updatedAt })));
    const combined = sources.map((source: any, index: number) => `SOURCE ${index + 1}\nTitle: ${source.title}\nDomain: ${source.domain}\nURL: ${source.url}\nRetrieved: ${source.retrievedAt}\nContent:\n${String(source.text ?? "").slice(0, 18000)}`).join("\n\n").slice(0, 200000);
    const extraction = await extractKnowledge(combined || `No source content was retrieved for ${job.subject}.`);
    const { data: existingRows } = await admin.from("aether_knowledge_candidates").select("id,normalized_content,claims,status").eq("owner_id", opts.ownerId).eq("project_id", opts.projectId ?? null).limit(200);
    const conflicts = findConflicts({ normalizedContent: extraction.normalizedContent, claims: extraction.claims }, (existingRows ?? []).map((row: any) => ({ id: row.id, normalizedContent: String(row.normalized_content ?? ""), claims: Array.isArray(row.claims) ? row.claims : [], status: row.status })));
    const freshnessStates = sources.map((s: any) => freshnessFromEvidence({ retrievedAt: s.retrievedAt, publishedAt: s.publishedAt, staleAt: null }));
    const freshness = mergeFreshness(freshnessStates.length ? freshnessStates : ["aging"]);
    const coverageSignals = [scope.core, scope.essentialContext, scope.relevantRelationships, scope.terminology, scope.verification].flat();
    const corpus = combined.toLowerCase();
    const covered = coverageSignals.filter((signal) => signal.split(/\s+/).filter((w) => w.length > 4).slice(0, 5).some((w) => corpus.includes(w.toLowerCase()))).length;
    const coverage = coverageSignals.length ? Math.min(1, covered / coverageSignals.length + (sources.length >= 5 ? 0.1 : 0)) : 0;
    const candidate = {
      owner_id: opts.ownerId,
      project_id: opts.projectId ?? null,
      title: `Knowledge: ${job.subject}`,
      content: combined || `Research did not return readable source content for ${job.subject}.`,
      normalized_content: extraction.normalizedContent,
      content_hash: extraction.contentHash,
      status: conflicts.length ? "conflicted" : "needs_review",
      freshness_state: freshness,
      confidence: Math.min(0.9, Math.max(0.25, sources.length ? 0.45 + Math.min(0.25, planned.result.diversity * 0.25) : 0.25)),
      verification_status: "pending",
      verification_run_id: null,
      source_ids: sourceIds.slice(0, 100),
      source_metadata: sources.map(sourceMetadata).slice(0, 100),
      claims: extraction.claims,
      entities: extraction.entities,
      relations: extraction.relations,
      conflicts,
      provenance: { acquisitionJobId: job.id, taskId: opts.taskId, runId: opts.runId, scope, targetType: job.target_type, targetModelKeys: job.target_model_keys, sourceComparison: comparison },
      metadata: { acquisition: "bounded-global", version: "1.0.0", relatedExpansionPolicy: "necessary-only", exclusions: scope.exclusions },
    };
    const { data: inserted, error: candidateError } = await admin.from("aether_knowledge_candidates").insert(candidate).select("id,status,confidence").single();
    if (candidateError || !inserted) throw new Error(candidateError?.message ?? "Could not persist knowledge candidate");
    const provenanceRows = sources.map((source: any) => ({ candidate_id: inserted.id, owner_id: opts.ownerId, project_id: opts.projectId ?? null, source_type: "research", source_id: source.id ?? null, source_url: source.url, verification_run_id: null, evidence_ids: [], metadata: { acquisitionJobId: job.id, contentHash: source.contentHash } })).filter((row: any) => row.source_id);
    if (provenanceRows.length) await admin.from("aether_knowledge_provenance").insert(provenanceRows);
    await admin.from("aether_knowledge_decisions").insert({ candidate_id: inserted.id, owner_id: opts.ownerId, actor_id: opts.ownerId, decision: "edit", previous_status: null, new_status: inserted.status, reason: "Bounded background knowledge acquisition completed; explicit review required.", metadata: { acquisitionJobId: job.id, coverage } });
    await appendTaskEvent(admin, { taskId: opts.taskId, runId: opts.runId, eventType: "knowledge.candidate.created", message: "Knowledge candidate created for explicit review", data: { candidate_id: inserted.id, source_count: sources.length, domain_count: planned.result.sourceDomains.length, coverage, confidence: inserted.confidence, freshness }, workerId: opts.workerId });
    const completedAt = new Date().toISOString();
    await admin.from("aether_knowledge_acquisition_jobs").update({ status: "waiting_approval", coverage, confidence: inserted.confidence, source_count: sources.length, domain_count: planned.result.sourceDomains.length, candidate_id: inserted.id, approval_status: "pending", completed_at: completedAt, last_event_at: completedAt, updated_at: completedAt, unresolved_items: planned.unmetRequirements }).eq("id", job.id);
    await transitionRunStatus(admin, opts.runId, "running", "waiting_approval", { outputs: { candidateId: inserted.id, coverage, sourceCount: sources.length, domainCount: planned.result.sourceDomains.length }, workerId: opts.workerId });
    await transitionTaskStatus(admin, opts.taskId, "running", "waiting_approval", { progress: Math.round(coverage * 100), detail: { phase: "knowledge_candidate_ready", candidateId: inserted.id, coverage }, workerId: opts.workerId });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const { data: task } = await admin.from("tasks").select("cancel_requested_at,deadline_at").eq("id", opts.taskId).maybeSingle();
      const cancelled = Boolean(task?.cancel_requested_at);
      const code = cancelled ? "cancelled" : "timeout_budget_exhausted";
      const now = new Date().toISOString();
      await admin.from("aether_knowledge_acquisition_jobs").update({ status: cancelled ? "cancelled" : "failed", cancel_reason: cancelled ? "Cancelled by administrator or owner" : "Research budget exhausted", completed_at: now, last_event_at: now, updated_at: now }).eq("id", job.id);
      await transitionRunStatus(admin, opts.runId, "running", cancelled ? "cancelled" : "failed", { failureCode: code, retryable: false, workerId: opts.workerId });
      await transitionTaskStatus(admin, opts.taskId, "running", cancelled ? "cancelled" : "failed", { workerId: opts.workerId });
      return;
    }
    throw error;
  } finally {
    clearInterval(timer);
  }
}
