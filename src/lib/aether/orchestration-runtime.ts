import type { SupabaseClient } from "@supabase/supabase-js";
import { appendTaskEvent, createRun, transitionRunStatus } from "./task-service";
import { traceOrchestrationEvent } from "./orchestration-trace";

export type StepState = "pending" | "ready" | "running" | "waiting_approval" | "completed" | "failed" | "skipped";
interface StepRow { id: string; sequence: number; dependencies: string[] | null; status: StepState; agent_key: string | null; model_role: string | null; title: string; expected_output: Record<string, unknown> | null; }
function dependencySatisfied(step: StepRow, steps: StepRow[]) { const deps = Array.isArray(step.dependencies) ? step.dependencies : []; return deps.every((dep) => steps.some((candidate) => (candidate.id === dep || candidate.id === String(dep)) && candidate.status === "completed")); }

export async function prepareNextOrchestrationSteps(admin: SupabaseClient, planId: string, actorId: string) {
  const { data: plan, error: planError } = await admin.from("orchestration_plans").select("id, task_id, run_id, owner_id, status, approval_status").eq("id", planId).maybeSingle();
  if (planError || !plan) throw new Error("Orchestration plan not found"); if (plan.owner_id !== actorId) throw new Error("Orchestration access denied");
  if (plan.approval_status === "pending") return { ready: [], waitingApproval: true };
  const { data: rawSteps, error } = await admin.from("orchestration_steps").select("id, sequence, dependencies, status, agent_key, model_role, title, expected_output").eq("plan_id", planId).order("sequence");
  if (error) throw new Error(error.message); const steps = (rawSteps ?? []) as StepRow[];
  const ready = steps.filter((step) => (step.status === "pending" || step.status === "ready") && dependencySatisfied(step, steps)); if (ready.length) await admin.from("orchestration_steps").update({ status: "ready" }).in("id", ready.map((step) => step.id)).eq("plan_id", planId); return { ready, waitingApproval: false };
}

export async function createAgentStepRun(admin: SupabaseClient, planId: string, stepId: string, actorId: string) {
  const { data: plan } = await admin.from("orchestration_plans").select("id, task_id, owner_id, run_id").eq("id", planId).maybeSingle(); if (!plan || plan.owner_id !== actorId) throw new Error("Orchestration access denied");
  const { data: step } = await admin.from("orchestration_steps").select("id, status, agent_key, model_role, title, task_id, plan_id").eq("id", stepId).eq("plan_id", planId).maybeSingle();
  if (!step || !["ready", "pending"].includes(step.status)) throw new Error("Step is not ready for execution"); if (!step.agent_key) throw new Error("Step has no authorized agent");
  const run = await createRun(admin, { task_id: plan.task_id, owner_id: actorId, agent_key: step.agent_key, inputs: { plan_id: planId, step_id: stepId, model_role: step.model_role }, timeout_ms: "1h", max_retries: 3, idempotency_key: `aether:orchestration-step:${planId}:${stepId}` });
  await admin.from("orchestration_steps").update({ status: "running", run_id: run.id, started_at: new Date().toISOString() }).eq("id", stepId).eq("plan_id", planId);
  await traceOrchestrationEvent(admin, { planId, taskId: plan.task_id, runId: run.id, stepId, actorId, actorType: "orchestrator", eventType: "step.delegated", action: "delegate_agent_step", reason: `Delegated step to authorized agent ${step.agent_key}`, decision: "execute", data: { agent_key: step.agent_key, model_role: step.model_role } }); return run;
}

export async function completeAgentStep(admin: SupabaseClient, planId: string, stepId: string, actorId: string, output: Record<string, unknown>) {
  const { data: plan } = await admin.from("orchestration_plans").select("id, task_id, owner_id").eq("id", planId).maybeSingle(); if (!plan || plan.owner_id !== actorId) throw new Error("Orchestration access denied");
  const { data: step } = await admin.from("orchestration_steps").select("id, run_id, status").eq("id", stepId).eq("plan_id", planId).maybeSingle(); if (!step || step.status !== "running") throw new Error("Step is not running");
  if (step.run_id) { const run = await admin.from("task_runs").select("status").eq("id", step.run_id).single(); if (!run.error && run.data) await transitionRunStatus(admin, step.run_id, run.data.status as "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled" | "paused" | "retrying" | "scheduled", "completed", { outputs: output, actorId }); }
  await admin.from("orchestration_steps").update({ status: "completed", ended_at: new Date().toISOString(), output }).eq("id", stepId).eq("plan_id", planId);
  await traceOrchestrationEvent(admin, { planId, taskId: plan.task_id, runId: step.run_id, stepId, actorId, actorType: "agent", eventType: "step.completed", action: "complete_agent_step", reason: "Agent step completed", decision: "continue", data: { output_keys: Object.keys(output) } }); await prepareNextOrchestrationSteps(admin, planId, actorId);
}

export async function failAgentStep(admin: SupabaseClient, planId: string, stepId: string, actorId: string, reason: string) {
  const { data: plan } = await admin.from("orchestration_plans").select("id, task_id, owner_id").eq("id", planId).maybeSingle(); if (!plan || plan.owner_id !== actorId) throw new Error("Orchestration access denied");
  const { data: step } = await admin.from("orchestration_steps").select("id, run_id, status").eq("id", stepId).eq("plan_id", planId).maybeSingle(); if (!step || step.status !== "running") throw new Error("Step is not running");
  if (step.run_id) { const run = await admin.from("task_runs").select("status").eq("id", step.run_id).single(); if (!run.error && run.data) await transitionRunStatus(admin, step.run_id, run.data.status as "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled" | "paused" | "retrying" | "scheduled", "failed", { error: reason, failureCode: "agent_step_failed", retryable: false, actorId }); }
  await admin.from("orchestration_steps").update({ status: "failed", ended_at: new Date().toISOString(), error: { message: reason } }).eq("id", stepId).eq("plan_id", planId); await appendTaskEvent(admin, { taskId: plan.task_id, eventType: "orchestration.step_failed", message: reason.slice(0, 1000), data: { plan_id: planId, step_id: stepId }, actorId }); await traceOrchestrationEvent(admin, { planId, taskId: plan.task_id, runId: step.run_id, stepId, actorId, actorType: "agent", eventType: "step.failed", action: "fail_agent_step", reason, decision: "escalate", data: {} });
}
