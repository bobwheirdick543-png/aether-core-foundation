import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENTS, type AgentKey } from "./agents";
import { AGENT_INTELLIGENCE } from "./agent-intelligence";
import { executeAaxChat } from "./aax-gateway";
import { executeAaxWebResearch } from "./aax-web-research";
import { appendTaskEvent, createRun, transitionRunStatus } from "./task-service";
import { traceOrchestrationEvent } from "./orchestration-trace";
import type { TaskStatus } from "./task-runtime";

export type StepState = "pending" | "ready" | "running" | "waiting_approval" | "completed" | "failed" | "skipped";
interface StepRow { id: string; sequence: number; dependencies: string[] | null; status: StepState; agent_key: string | null; model_role: string | null; title: string; expected_output: Record<string, unknown> | null; step_key?: string | null; output?: Record<string, unknown> | null; }
function dependencySatisfied(step: StepRow, steps: StepRow[]) { const deps = Array.isArray(step.dependencies) ? step.dependencies : []; return deps.every((dep) => steps.some((candidate) => (candidate.id === dep || candidate.id === String(dep) || candidate.step_key === String(dep)) && candidate.status === "completed")); }
function tokenize(value: string) { return Array.from(new Set(value.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]{2,}/gu) ?? [])); }

async function retrieveApprovedKnowledgeForPlan(admin: SupabaseClient, ownerId: string, projectId: string | null, query: string) {
  const terms = tokenize(query).slice(0, 32); if (!terms.length) return [];
  let chunkQuery = admin.from("aether_knowledge_chunks").select("id,entry_id,project_id,version,content,metadata").eq("owner_id", ownerId).eq("is_current", true);
  if (projectId) chunkQuery = chunkQuery.eq("project_id", projectId);
  const { data: chunks, error: chunkError } = await chunkQuery.limit(3000); if (chunkError) throw new Error(`Approved knowledge retrieval failed: ${chunkError.message}`);
  const entryIds = Array.from(new Set((chunks ?? []).map((chunk) => chunk.entry_id))); if (!entryIds.length) return [];
  const { data: entries, error: entryError } = await admin.from("knowledge_entries").select("id,title,stage,current_version").eq("owner_id", ownerId).eq("stage", "production").in("id", entryIds); if (entryError) throw new Error(`Approved knowledge metadata lookup failed: ${entryError.message}`);
  const entryMap = new Map((entries ?? []).map((entry) => [entry.id, entry]));
  return (chunks ?? []).map((chunk) => { const entry = entryMap.get(chunk.entry_id); if (!entry) return null; const lower = String(chunk.content ?? "").toLowerCase(); const matched = terms.filter((term) => lower.includes(term)); return { entryId: entry.id, title: entry.title, version: entry.current_version, score: matched.length / terms.length, matchedTerms: matched, content: String(chunk.content ?? "").slice(0, 4000), provenance: { source: "approved-production-knowledge", version: entry.current_version, chunkId: chunk.id } }; }).filter((value): value is NonNullable<typeof value> => Boolean(value)).filter((value) => value.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
}

export async function prepareNextOrchestrationSteps(admin: SupabaseClient, planId: string, actorId: string) { const { data: plan, error: planError } = await admin.from("orchestration_plans").select("id, task_id, run_id, owner_id, context, status, approval_status").eq("id", planId).maybeSingle(); if (planError || !plan) throw new Error("Orchestration plan not found"); if (plan.owner_id !== actorId) throw new Error("Orchestration access denied"); if (plan.approval_status === "pending") return { ready: [], waitingApproval: true }; const { data: rawSteps, error } = await admin.from("orchestration_steps").select("id, sequence, step_key, dependencies, status, agent_key, model_role, title, expected_output, output").eq("plan_id", planId).order("sequence"); if (error) throw new Error(error.message); const steps = (rawSteps ?? []) as StepRow[]; const ready = steps.filter((step) => (step.status === "pending" || step.status === "ready") && dependencySatisfied(step, steps)); if (ready.length) await admin.from("orchestration_steps").update({ status: "ready" }).in("id", ready.map((step) => step.id)).eq("plan_id", planId); return { ready, waitingApproval: false }; }

export async function createAgentStepRun(admin: SupabaseClient, planId: string, stepId: string, actorId: string) { const { data: plan } = await admin.from("orchestration_plans").select("id, task_id, owner_id, run_id, context").eq("id", planId).maybeSingle(); if (!plan || plan.owner_id !== actorId) throw new Error("Orchestration access denied"); const { data: step } = await admin.from("orchestration_steps").select("id, status, agent_key, model_role, title, task_id, plan_id, sequence").eq("id", stepId).eq("plan_id", planId).maybeSingle(); if (!step || !["ready", "pending"].includes(step.status)) throw new Error("Step is not ready for execution"); if (!step.agent_key) throw new Error("Step has no authorized agent"); const context = plan.context && typeof plan.context === "object" ? plan.context as Record<string, unknown> : {}; const query = String(context.requestText ?? context.query ?? "").trim().slice(0, 20000); const projectId = typeof context.projectId === "string" ? context.projectId : null; const approvedKnowledge = await retrieveApprovedKnowledgeForPlan(admin, actorId, projectId, query);
  const { data: priorSteps } = await admin.from("orchestration_steps").select("sequence,step_key,output,agent_key,status").eq("plan_id", planId).lt("sequence", step.sequence).order("sequence", { ascending: true });
  const priorOutputs = (priorSteps ?? []).filter((item: any) => item.status === "completed").map((item: any) => ({ stepKey: item.step_key, agentKey: item.agent_key, output: item.output ?? {} }));
  const run = await createRun(admin, { task_id: plan.task_id, owner_id: actorId, agent_key: step.agent_key, inputs: { plan_id: planId, step_id: stepId, model_role: step.model_role, approved_knowledge: approvedKnowledge, prior_outputs: priorOutputs }, timeout_ms: "1h", max_retries: 3, idempotency_key: `aether:orchestration-step:${planId}:${stepId}` }); await admin.from("orchestration_steps").update({ status: "running", run_id: run.id, started_at: new Date().toISOString() }).eq("id", stepId).eq("plan_id", planId); await traceOrchestrationEvent(admin, { planId, taskId: plan.task_id, runId: run.id, stepId, actorId, actorType: "orchestrator", eventType: "step.delegated", action: "delegate_agent_step", reason: `Delegated step to authorized agent ${step.agent_key}`, decision: "execute", data: { agent_key: step.agent_key, model_role: step.model_role, approvedKnowledgeCount: approvedKnowledge.length } }); return run; }

export async function executeAgentStep(admin: SupabaseClient, planId: string, stepId: string, actorId: string, signal?: AbortSignal) {
  const { data: plan } = await admin.from("orchestration_plans").select("id,task_id,owner_id,context").eq("id", planId).maybeSingle();
  if (!plan || plan.owner_id !== actorId) throw new Error("Orchestration access denied");
  const { data: step } = await admin.from("orchestration_steps").select("id,sequence,agent_key,status,run_id,title,expected_output").eq("id", stepId).eq("plan_id", planId).maybeSingle();
  if (!step || step.status !== "running" || !step.agent_key || !step.run_id) throw new Error("Agent step is not executable");
  const agent = AGENTS.find((item) => item.key === step.agent_key);
  if (!agent) throw new Error(`Agent ${step.agent_key} is not registered`);
  const { data: run } = await admin.from("task_runs").select("inputs").eq("id", step.run_id).maybeSingle();
  const inputs = run?.inputs && typeof run.inputs === "object" ? run.inputs as Record<string, unknown> : {};
  const { data: models } = await admin.from("aax_models").select("model_key").eq("release_status","available").order("generation",{ascending:false}).order("revision",{ascending:false}).limit(1);
  const modelKey = models?.[0]?.model_key;
  if (!modelKey) throw new Error("No available AAX model is configured for orchestration execution");
  const intelligence = AGENT_INTELLIGENCE[step.agent_key as AgentKey];
  const system = [
    `You are the ${agent.name} executing a real Aether orchestration step.`,
    `Mission: ${agent.mission}`,
    `Responsibilities: ${agent.responsibilities.join("; ")}`,
    `Prohibited actions: ${agent.prohibited.join("; ")}`,
    intelligence ? `Focus: ${intelligence.focus.join("; ")}` : "",
    intelligence ? `Preserve: ${intelligence.mustPreserve.join("; ")}` : "",
    intelligence ? `Handoff: ${intelligence.handoff.join("; ")}` : "",
    "Use only evidence supplied in this step unless you are the Research or Knowledge Acquisition Agent, in which case native Aether web research is permitted.",
    "Never claim an action occurred unless this runtime actually persisted it.",
  ].filter(Boolean).join("\n");
  const requestText = String((plan.context as any)?.requestText ?? "").trim();
  const contextText = JSON.stringify({ approvedKnowledge: inputs.approved_knowledge ?? [], priorOutputs: inputs.prior_outputs ?? [], expectedOutput: step.expected_output ?? {} }).slice(0, 60_000);
  const messages = [{ role: "system" as const, content: system }, { role: "user" as const, content: `Original request:\n${requestText}\n\nExecution context:\n${contextText}\n\nPerform your assigned agent step and return a concise structured result with findings, evidence/provenance, unresolved issues, and the recommended next handoff.` }];
  const useWeb = step.agent_key === "research" || step.agent_key === "knowledge-acquisition";
  const response = useWeb
    ? await executeAaxWebResearch(admin, { modelKey, messages, maxOutputTokens: 4096, signal, telemetry: { userId: actorId, taskId: plan.task_id, runId: step.run_id } })
    : await executeAaxChat(admin, { modelKey, messages, maxOutputTokens: 4096, signal, telemetry: { userId: actorId, taskId: plan.task_id, runId: step.run_id, kind: `aax.agent.${step.agent_key}` } });
  await completeAgentStep(admin, planId, stepId, actorId, { content: response.content, modelKey: response.modelKey, provider: response.provider, providerModel: response.providerModel, sources: "sources" in response ? response.sources : [], tokensIn: response.tokensIn, tokensOut: response.tokensOut, latencyMs: response.latencyMs, webResearch: useWeb });
  return response;
}

export async function completeAgentStep(admin: SupabaseClient, planId: string, stepId: string, actorId: string, output: Record<string, unknown>) {
  const { data: plan } = await admin.from("orchestration_plans").select("id, task_id, owner_id").eq("id", planId).maybeSingle();
  if (!plan || plan.owner_id !== actorId) throw new Error("Orchestration access denied");
  const { data: step } = await admin.from("orchestration_steps").select("id, run_id, status").eq("id", stepId).eq("plan_id", planId).maybeSingle();
  if (!step || step.status !== "running") throw new Error("Step is not running");
  if (step.run_id) {
    const run = await admin.from("task_runs").select("status").eq("id", step.run_id).single();
    if (!run.error && run.data) await transitionRunStatus(admin, step.run_id, run.data.status as TaskStatus, "completed", { outputs: output, actorId });
  }
  await admin.from("orchestration_steps").update({ status: "completed", ended_at: new Date().toISOString(), output }).eq("id", stepId).eq("plan_id", planId);
  await traceOrchestrationEvent(admin, { planId, taskId: plan.task_id, runId: step.run_id, stepId, actorId, actorType: "agent", eventType: "step.completed", action: "complete_agent_step", reason: "Agent step completed", decision: "continue", data: { output_keys: Object.keys(output) } });
  const { data: failedSteps } = await admin.from("orchestration_steps").select("id,status,error").eq("plan_id", planId).eq("status", "failed");
  if ((failedSteps ?? []).length) {
    await admin.from("orchestration_plans").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", planId);
    await admin.from("tasks").update({ status: "failed", completed_at: new Date().toISOString(), last_error_code: "agent_step_failed", last_error_message: String((failedSteps?.[0] as any)?.error?.message ?? "A specialized agent step failed"), detail: { phase: "orchestration_failed", plan_id: planId } }).eq("id", plan.task_id);
  } else {
    const { data: remaining } = await admin.from("orchestration_steps").select("id,status").eq("plan_id", planId).in("status", ["pending","ready","running","waiting_approval"]);
    if (!(remaining ?? []).length) {
      await admin.from("orchestration_plans").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", planId);
      await admin.from("tasks").update({ status: "completed", progress: 100, completed_at: new Date().toISOString(), detail: { phase: "orchestration_complete", plan_id: planId } }).eq("id", plan.task_id);
    } else {
    await prepareNextOrchestrationSteps(admin, planId, actorId);
  }
}

export async function failAgentStep(admin: SupabaseClient, planId: string, stepId: string, actorId: string, reason: string) { const { data: plan } = await admin.from("orchestration_plans").select("id, task_id, owner_id").eq("id", planId).maybeSingle(); if (!plan || plan.owner_id !== actorId) throw new Error("Orchestration access denied"); const { data: step } = await admin.from("orchestration_steps").select("id, run_id, status").eq("id", stepId).eq("plan_id", planId).maybeSingle(); if (!step || step.status !== "running") throw new Error("Step is not running"); if (step.run_id) { const run = await admin.from("task_runs").select("status").eq("id", step.run_id).single(); if (!run.error && run.data) await transitionRunStatus(admin, step.run_id, run.data.status as TaskStatus, "failed", { error: reason, failureCode: "agent_step_failed", retryable: false, actorId }); } await admin.from("orchestration_steps").update({ status: "failed", ended_at: new Date().toISOString(), error: { message: reason } }).eq("id", stepId).eq("plan_id", planId); await appendTaskEvent(admin, { taskId: plan.task_id, eventType: "orchestration.step_failed", message: reason.slice(0, 1000), data: { plan_id: planId, step_id: stepId }, actorId }); await traceOrchestrationEvent(admin, { planId, taskId: plan.task_id, runId: step.run_id, stepId, actorId, actorType: "agent", eventType: "step.failed", action: "fail_agent_step", reason, decision: "escalate", data: {} }); }
