import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { EVALUATION_TARGETS, executeEvaluationRun, type EvaluationTarget } from "@/lib/aether/evaluation-lab";
import type { SupabaseClient } from "@supabase/supabase-js";

async function admin(context: { supabase: unknown; userId: string }) {
  const db = context.supabase as SupabaseClient;
  const { data, error } = await db.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Response("Unable to verify administrator authorization", { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}
const target = (value: string): EvaluationTarget => { if (!EVALUATION_TARGETS.includes(value as EvaluationTarget)) throw new Response("Invalid evaluation target", { status: 400 }); return value as EvaluationTarget; };

export const getEvaluationOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await admin(context);
  const [{ data: runs, error: re }, { data: cases, error: ce }] = await Promise.all([
    supabaseAdmin.from("evaluation_runs").select("id,target,status,score,passed,latency_ms,failure_rate,retry_rate,approval_rate,version,environment,evaluator,created_at,completed_at").order("created_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("evaluation_test_cases").select("id,name,target,active,updated_at").order("updated_at", { ascending: false }).limit(500),
  ]);
  if (re || ce) throw new Response(re?.message ?? ce?.message ?? "Could not load evaluation data", { status: 500 });
  const all = runs ?? []; const completed = all.filter((r) => r.status === "completed"); const passed = completed.filter((r) => r.passed); const avg = (field: "latency_ms" | "failure_rate" | "retry_rate" | "approval_rate") => completed.length ? completed.reduce((s, r) => s + Number(r[field] ?? 0), 0) / completed.length : 0;
  return { targets: EVALUATION_TARGETS, testCases: cases ?? [], runs: all.slice(0, 200), metrics: { totalRuns: all.length, completedRuns: completed.length, passRate: completed.length ? passed.length / completed.length : 0, averageLatencyMs: avg("latency_ms"), failureRate: avg("failure_rate"), retryRate: avg("retry_rate"), approvalRate: avg("approval_rate") } };
});

export const getEvaluationRuns = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d?: { target?: string; limit?: number }) => ({ target: d?.target, limit: Math.min(500, Math.max(1, Math.floor(Number(d?.limit ?? 100)))) })).handler(async ({ context, data }) => {
  await admin(context); let q = supabaseAdmin.from("evaluation_runs").select("id,test_case_id,target,version,environment,evaluator,status,expected_outcome,actual_output,score,passed,latency_ms,failure_rate,retry_rate,approval_rate,resource_usage,trace,errors,warnings,related_task_id,started_at,completed_at,created_at").order("created_at", { ascending: false }).limit(data.limit); if (data.target) q = q.eq("target", target(data.target)); const { data: rows, error } = await q; if (error) throw new Response(error.message, { status: 500 }); return rows ?? [];
});

export const getEvaluationTestCases = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await admin(context); const { data, error } = await supabaseAdmin.from("evaluation_test_cases").select("*").order("updated_at", { ascending: false }); if (error) throw new Response(error.message, { status: 500 }); return data ?? []; });

export const saveEvaluationTestCase = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { id?: string; name: string; description?: string; target: string; input?: Record<string, unknown>; expectedOutcome?: Record<string, unknown>; tags?: string[]; active?: boolean }) => ({ ...d, name: String(d.name).trim().slice(0, 160), target: target(String(d.target)), description: d.description?.trim().slice(0, 1000), input: d.input ?? {}, expectedOutcome: d.expectedOutcome ?? {}, tags: (d.tags ?? []).map(String).slice(0, 20), active: d.active !== false })).handler(async ({ context, data }) => {
  await admin(context); const payload = { owner_id: context.userId, name: data.name, description: data.description ?? null, target: data.target, input: data.input, expected_outcome: data.expectedOutcome, tags: data.tags, active: data.active, updated_at: new Date().toISOString() }; const query = data.id ? supabaseAdmin.from("evaluation_test_cases").update(payload).eq("id", data.id).eq("owner_id", context.userId) : supabaseAdmin.from("evaluation_test_cases").insert(payload); const { data: row, error } = await query.select().single(); if (error || !row) throw new Response(error?.message ?? "Could not save test case", { status: 500 }); return row;
});

export const deleteEvaluationTestCase = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { id: string }) => ({ id: String(d.id) })).handler(async ({ context, data }) => { await admin(context); const { error } = await supabaseAdmin.from("evaluation_test_cases").delete().eq("id", data.id).eq("owner_id", context.userId); if (error) throw new Response(error.message, { status: 500 }); return { ok: true }; });

export const runEvaluationTestCase = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { testCaseId: string; environment?: string; version?: string; evaluator?: string }) => ({ testCaseId: String(d.testCaseId), environment: String(d.environment ?? "admin").trim().slice(0, 80), version: String(d.version ?? "current").trim().slice(0, 120), evaluator: String(d.evaluator ?? "evaluation-lab").trim().slice(0, 120) })).handler(async ({ context, data }) => {
  await admin(context); const { data: tc, error: ce } = await supabaseAdmin.from("evaluation_test_cases").select("id,target,input,expected_outcome,owner_id").eq("id", data.testCaseId).maybeSingle(); if (ce) throw new Response(ce.message, { status: 500 }); if (!tc) throw new Response("Test case not found", { status: 404 }); const { data: run, error } = await supabaseAdmin.from("evaluation_runs").insert({ test_case_id: tc.id, owner_id: context.userId, target: tc.target, version: data.version, environment: data.environment, evaluator: data.evaluator, expected_outcome: tc.expected_outcome, status: "queued" }).select("id").single(); if (error || !run) throw new Response(error?.message ?? "Could not create evaluation run", { status: 500 });
  try { return await executeEvaluationRun(supabaseAdmin, run.id, tc.target as EvaluationTarget, tc.input as Record<string, unknown>, tc.expected_outcome as Record<string, unknown>); } catch { return { status: "failed", runId: run.id }; }
});

export const getEvaluationRun = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { id: string }) => ({ id: String(d.id) })).handler(async ({ context, data }) => { await admin(context); const [{ data: run, error: re }, { data: events, error: ee }] = await Promise.all([supabaseAdmin.from("evaluation_runs").select("*").eq("id", data.id).maybeSingle(), supabaseAdmin.from("evaluation_run_events").select("id,event_type,stage,payload,created_at").eq("run_id", data.id).order("created_at", { ascending: true })]); if (re || ee) throw new Response(re?.message ?? ee?.message ?? "Could not load evaluation run", { status: 500 }); if (!run) throw new Response("Evaluation run not found", { status: 404 }); return { run, events: events ?? [] }; });

export const compareEvaluationRuns = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { runA: string; runB: string }) => d).handler(async ({ context, data }) => { await admin(context); const { data: rows, error } = await supabaseAdmin.from("evaluation_runs").select("id,target,version,environment,status,score,passed,latency_ms,failure_rate,retry_rate,approval_rate,created_at").in("id", [data.runA, data.runB]); if (error) throw new Response(error.message, { status: 500 }); if ((rows ?? []).length !== 2) throw new Response("Both evaluation runs are required", { status: 404 }); const a = rows!.find((r) => r.id === data.runA)!; const b = rows!.find((r) => r.id === data.runB)!; return { a, b, delta: { score: Number(b.score) - Number(a.score), latencyMs: Number(b.latency_ms ?? 0) - Number(a.latency_ms ?? 0), failureRate: Number(b.failure_rate ?? 0) - Number(a.failure_rate ?? 0), retryRate: Number(b.retry_rate ?? 0) - Number(a.retry_rate ?? 0), approvalRate: Number(b.approval_rate ?? 0) - Number(a.approval_rate ?? 0) } }; });
