import type { SupabaseClient } from "@supabase/supabase-js";

/** Shared-learning boundary: candidates remain isolated until an administrator approves them. */
export async function listApprovedLearning(admin: SupabaseClient, agentKey: string, limit = 50) {
  const { data, error } = await admin.from("agent_learning_records").select("id, agent_key, source_agent_key, source_type, source_id, candidate, confidence, approved_by, approved_at, created_at").eq("status", "approved").or(`agent_key.eq.${agentKey},agent_key.eq.global`).order("approved_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 200));
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function buildLearningContext(records: Array<{ candidate: Record<string, unknown>; confidence?: number | null }>, maxItems = 20) {
  return records.slice(0, Math.max(0, maxItems)).map((record) => ({ candidate: record.candidate, confidence: record.confidence ?? null }));
}
