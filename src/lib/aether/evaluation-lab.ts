import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENTS } from "./agents";
import { buildWorkflowSteps, classifyIntent, validateOrchestrationPlan } from "./orchestrator";

export const EVALUATION_TARGETS = ["agents","orchestrator","research","verification","knowledge","reports","notifications","modules","battle-versia"] as const;
export type EvaluationTarget = (typeof EVALUATION_TARGETS)[number];

function safeText(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }
function expectedScore(actual: unknown, expected: Record<string, unknown>) {
  const required = Array.isArray(expected.requiredFields) ? expected.requiredFields : [];
  if (required.length) {
    const missing = required.filter((field) => !(field in ((actual ?? {}) as Record<string, unknown>)));
    return { score: missing.length ? Math.max(0, 1 - missing.length / required.length) : 1, missing };
  }
  if (typeof expected.contains === "string") {
    const haystack = JSON.stringify(actual).toLowerCase();
    const needle = expected.contains.toLowerCase();
    return { score: haystack.includes(needle) ? 1 : 0, missing: haystack.includes(needle) ? [] : [expected.contains] };
  }
  return { score: 1, missing: [] as string[] };
}

async function executeTarget(target: EvaluationTarget, input: Record<string, unknown>, db: SupabaseClient) {
  if (target === "orchestrator") {
    const request = safeText(input.request ?? input.prompt ?? input.message);
    const plan = classifyIntent(request);
    validateOrchestrationPlan(plan);
    const taskId = safeText(input.taskId, 120) || `evaluation:${crypto.randomUUID()}`;
    const workflow = buildWorkflowSteps(plan, taskId);
    return { adapter: "orchestrator.runtime", executed: true, intent: plan.intent, capabilities: plan.capabilities, agents: plan.agents, riskLevel: plan.riskLevel, approvalRequired: plan.approvalRequired, workflow };
  }

  if (target === "agents") {
    const requested = safeText(input.agentKey, 80);
    const agents = requested ? AGENTS.filter((agent) => agent.key === requested) : AGENTS;
    if (!agents.length) throw new Error(`Unknown agent: ${requested}`);
    return { adapter: "agent.registry", executed: true, agents: agents.map((agent) => ({ key: agent.key, name: agent.name, status: agent.status, tools: agent.tools, prohibited: agent.prohibited, permissionCount: agent.permissions.length })) };
  }

  // These targets intentionally fail closed until their real runtime executor is registered.
  // An evaluation must never report a successful result for a simulated execution.
  const tableByTarget: Partial<Record<EvaluationTarget, string>> = {
    research: "aether_research_sessions",
    verification: "knowledge_entries",
    knowledge: "knowledge_entries",
    reports: "reports",
    notifications: "notifications",
    modules: "modules",
    "battle-versia": "battleversia_games",
  };
  const table = tableByTarget[target];
  if (!table) throw new Error(`No evaluation adapter registered for ${target}`);
  const { error } = await db.from(table).select("id", { head: true, count: "exact" }).limit(1);
  if (error) throw new Error(`${target} evaluation adapter is not executable: ${error.message}`);
  throw new Error(`${target} evaluation adapter is not executable yet; no simulation was recorded`);
}

export async function executeEvaluationRun(db: SupabaseClient, runId: string, target: EvaluationTarget, input: Record<string, unknown>, expected: Record<string, unknown>) {
  const started = Date.now();
  await db.from("evaluation_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", runId);
  await db.from("evaluation_run_events").insert({ run_id: runId, event_type: "started", stage: "evaluation", payload: { target } });
  try {
    const actual = await executeTarget(target, input, db);
    const scored = expectedScore(actual, expected);
    const latencyMs = Date.now() - started;
    const passed = scored.score >= Number(expected.minimumScore ?? 1);
    const trace = [{ stage: "execution", status: "completed", adapter: actual.adapter, at: new Date().toISOString() }];
    await db.from("evaluation_runs").update({ status: "completed", actual_output: actual, score: scored.score, passed, latency_ms: latencyMs, failure_rate: 0, retry_rate: 0, approval_rate: actual.approvalRequired ? 1 : 0, resource_usage: { wallClockMs: latencyMs }, trace, warnings: scored.missing.length ? [{ code: "expectation_mismatch", missing: scored.missing }] : [], completed_at: new Date().toISOString() }).eq("id", runId);
    await db.from("evaluation_run_events").insert({ run_id: runId, event_type: "completed", stage: "evaluation", payload: { score: scored.score, passed, latencyMs } });
    return { status: "completed", score: scored.score, passed, latencyMs, actual };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const latencyMs = Date.now() - started;
    await db.from("evaluation_runs").update({ status: "failed", passed: false, score: 0, latency_ms: latencyMs, failure_rate: 1, errors: [{ message }], completed_at: new Date().toISOString() }).eq("id", runId);
    await db.from("evaluation_run_events").insert({ run_id: runId, event_type: "failed", stage: "evaluation", payload: { message, latencyMs } });
    throw error;
  }
}
