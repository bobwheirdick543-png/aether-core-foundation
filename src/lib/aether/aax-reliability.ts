import type { SupabaseClient } from "@supabase/supabase-js";

export type AaxHealthState = "healthy" | "degraded" | "unavailable" | "cooldown" | "disabled";

export interface AaxRouteCandidate { modelKey: string; provider: string | null; health: AaxHealthState; score: number; }

export function rankAaxCandidates(candidates: AaxRouteCandidate[]): AaxRouteCandidate[] {
  const weight: Record<AaxHealthState, number> = { healthy: 4, degraded: 2, cooldown: 0, unavailable: -5, disabled: -10 };
  return candidates.filter((c) => weight[c.health] > -1).sort((a, b) => (weight[b.health] + b.score) - (weight[a.health] + a.score));
}

export async function recordAaxHealth(admin: SupabaseClient, modelId: string, state: AaxHealthState, details: Record<string, unknown> = {}) {
  const { error } = await admin.from("aax_model_health").upsert({ model_id: modelId, state, details, checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "model_id" });
  if (error) throw new Error(error.message);
}
