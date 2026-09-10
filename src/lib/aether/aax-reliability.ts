import type { SupabaseClient } from "@supabase/supabase-js";

export type AaxHealthState = "healthy" | "degraded" | "unavailable" | "cooldown" | "disabled";

export interface AaxRouteCandidate {
  modelKey: string;
  provider: string | null;
  health: AaxHealthState;
  score: number;
}

const weight: Record<AaxHealthState, number> = {
  healthy: 4,
  degraded: 2,
  cooldown: 0,
  unavailable: -5,
  disabled: -10,
};

export function rankAaxCandidates(candidates: AaxRouteCandidate[]): AaxRouteCandidate[] {
  return candidates
    .filter((candidate) => weight[candidate.health] >= 0)
    .sort((a, b) => (weight[b.health] + b.score) - (weight[a.health] + a.score));
}

export async function getAaxHealth(admin: SupabaseClient, modelId: string) {
  const { data, error } = await admin.from("aax_model_health").select("*").eq("model_id", modelId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function recordAaxHealth(
  admin: SupabaseClient,
  modelId: string,
  outcome: "success" | "failure",
  details: { error?: string; latencyMs?: number; fallback?: boolean } = {},
) {
  const existing = await getAaxHealth(admin, modelId);
  const now = new Date().toISOString();
  const failures = outcome === "failure" ? Number(existing?.consecutive_failures ?? 0) + 1 : 0;
  const successes = outcome === "success" ? Number(existing?.consecutive_successes ?? 0) + 1 : 0;
  const totalRequests = Number(existing?.total_requests ?? 0) + 1;
  const totalFailures = Number(existing?.total_failures ?? 0) + (outcome === "failure" ? 1 : 0);
  const totalFallbacks = Number(existing?.total_fallbacks ?? 0) + (details.fallback ? 1 : 0);
  const state: AaxHealthState = existing?.state === "disabled"
    ? "disabled"
    : outcome === "failure"
      ? (failures >= 3 ? "cooldown" : "degraded")
      : "healthy";
  const cooldownUntil = state === "cooldown" ? new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, failures - 3))).toISOString() : null;
  const { data, error } = await admin.from("aax_model_health").upsert({
    model_id: modelId,
    state,
    consecutive_failures: failures,
    consecutive_successes: successes,
    total_requests: totalRequests,
    total_failures: totalFailures,
    total_fallbacks: totalFallbacks,
    cooldown_until: cooldownUntil,
    last_error: outcome === "failure" ? (details.error ?? "AAX provider request failed") : null,
    last_error_at: outcome === "failure" ? now : existing?.last_error_at ?? null,
    last_success_at: outcome === "success" ? now : existing?.last_success_at ?? null,
    updated_at: now,
  }, { onConflict: "model_id" }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export function isAaxHealthUsable(health: { state?: string | null; cooldown_until?: string | null } | null): boolean {
  if (!health) return true;
  if (health.state === "disabled" || health.state === "unavailable") return false;
  if (health.state === "cooldown" && health.cooldown_until && new Date(health.cooldown_until).getTime() > Date.now()) return false;
  return true;
}
