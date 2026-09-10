import type { SupabaseClient } from "@supabase/supabase-js";

export interface AaxEvaluationCase { id: string; input: string; expected?: string; metadata?: Record<string, unknown>; }
export interface AaxEvaluationResult { caseId: string; passed: boolean; score: number; latencyMs: number; metadata?: Record<string, unknown>; }

export function summarizeAaxEvaluation(results: AaxEvaluationResult[]) {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const score = total ? results.reduce((sum, r) => sum + r.score, 0) / total : 0;
  const latencyMs = total ? results.reduce((sum, r) => sum + r.latencyMs, 0) / total : 0;
  return { total, passed, passRate: total ? passed / total : 0, score, averageLatencyMs: latencyMs };
}

export async function recordAaxEvaluation(admin: SupabaseClient, modelId: string, results: AaxEvaluationResult[], metadata: Record<string, unknown> = {}) {
  const summary = summarizeAaxEvaluation(results);
  const { data, error } = await admin.from("aax_evaluations").insert({ model_id: modelId, results, summary, metadata }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
