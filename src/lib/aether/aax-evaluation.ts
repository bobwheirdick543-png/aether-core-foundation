import type { SupabaseClient } from "@supabase/supabase-js";
import { executeAaxChat } from "./aax-gateway";

export interface AaxEvaluationCase {
  id: string;
  input: string;
  expected?: string;
  metadata?: Record<string, unknown>;
}

export interface AaxEvaluationResult {
  caseId: string;
  passed: boolean;
  score: number;
  latencyMs: number;
  output: string;
  metadata?: Record<string, unknown>;
}

export function summarizeAaxEvaluation(results: AaxEvaluationResult[]) {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const score = total ? results.reduce((sum, r) => sum + r.score, 0) / total : 0;
  const latencyMs = total ? results.reduce((sum, r) => sum + r.latencyMs, 0) / total : 0;
  return { total, passed, passRate: total ? passed / total : 0, score, averageLatencyMs: latencyMs };
}

function normalize(value: string): string { return value.trim().replace(/\s+/g, " ").toLowerCase(); }
function scoreOutput(output: string, expected?: string): { passed: boolean; score: number } {
  if (!expected) return { passed: true, score: 1 };
  const actual = normalize(output);
  const target = normalize(expected);
  if (actual === target) return { passed: true, score: 1 };
  if (actual.includes(target)) return { passed: true, score: 0.8 };
  return { passed: false, score: 0 };
}

export async function runAaxEvaluation(
  admin: SupabaseClient,
  modelId: string,
  modelKey: string,
  suiteKey: string,
  cases: AaxEvaluationCase[],
  metadata: Record<string, unknown> = {},
) {
  const { data: evaluation, error: createError } = await admin.from("aax_evaluations").insert({
    model_id: modelId,
    suite_key: suiteKey,
    status: "running",
    cases,
    metadata,
    started_at: new Date().toISOString(),
  }).select().single();
  if (createError || !evaluation) throw new Error(createError?.message ?? "Could not create AAX evaluation");

  const results: AaxEvaluationResult[] = [];
  try {
    for (const testCase of cases) {
      const started = Date.now();
      const response = await executeAaxChat(admin, {
        modelKey,
        messages: [{ role: "user", content: testCase.input }],
        telemetry: { kind: "aax.evaluation", runId: null },
      });
      const result = scoreOutput(response.content, testCase.expected);
      results.push({ caseId: testCase.id, ...result, latencyMs: Date.now() - started, output: response.content, metadata: testCase.metadata });
    }
    const summary = summarizeAaxEvaluation(results);
    const { error } = await admin.from("aax_evaluations").update({ status: "completed", results, summary, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", evaluation.id);
    if (error) throw new Error(error.message);
    return { ...evaluation, status: "completed", results, summary };
  } catch (error) {
    await admin.from("aax_evaluations").update({ status: "failed", metadata: { ...metadata, error: error instanceof Error ? error.message : String(error) }, updated_at: new Date().toISOString() }).eq("id", evaluation.id);
    throw error;
  }
}

export async function recordAaxEvaluation(admin: SupabaseClient, modelId: string, results: AaxEvaluationResult[], metadata: Record<string, unknown> = {}) {
  const summary = summarizeAaxEvaluation(results);
  const { data, error } = await admin.from("aax_evaluations").insert({ model_id: modelId, suite_key: String(metadata.suiteKey ?? "manual"), status: "completed", results, summary, metadata, completed_at: new Date().toISOString() }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
