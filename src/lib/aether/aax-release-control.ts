import type { SupabaseClient } from "@supabase/supabase-js";

export const AAX_RELEASE_STATES = ["draft", "training", "evaluation", "approved", "scheduled", "announced", "available", "deprecated", "retired"] as const;
export type AaxReleaseState = typeof AAX_RELEASE_STATES[number];

const NEXT: Record<AaxReleaseState, AaxReleaseState[]> = {
  draft: ["training", "retired"],
  training: ["evaluation", "draft", "retired"],
  evaluation: ["approved", "training", "retired"],
  approved: ["scheduled", "announced", "available", "retired"],
  scheduled: ["announced", "available", "approved", "retired"],
  announced: ["available", "scheduled", "retired"],
  available: ["deprecated", "retired"],
  deprecated: ["available", "retired"],
  retired: [],
};

export function isAaxReleased(status: string, availableAt: string | null | undefined, now = new Date()) {
  return status.toLowerCase() === "available" && (!availableAt || new Date(availableAt).getTime() <= now.getTime());
}

export async function assertAaxCanRun(admin: SupabaseClient, modelKey: string) {
  const { data, error } = await admin.rpc("get_available_aax_model", { p_model_key: modelKey });
  if (error) throw new Error(error.message);
  const model = (Array.isArray(data) ? data[0] : data) as { release_status?: string; available_at?: string | null } | undefined;
  if (!model || !isAaxReleased(String(model.release_status ?? ""), model.available_at)) throw new Error("AAX model is not released or is not available yet");
  return model;
}

export function canTransitionAaxRelease(from: string, to: AaxReleaseState) {
  return (NEXT[from.toLowerCase() as AaxReleaseState] ?? []).includes(to);
}

export async function transitionAaxRelease(admin: SupabaseClient, modelId: string, to: AaxReleaseState, actorId: string, note?: string) {
  const { data: current, error: readError } = await admin.from("aax_models").select("id,model_key,release_status,scheduled_release_at,available_at").eq("id", modelId).single();
  if (readError || !current) throw new Error(readError?.message ?? "AAX model not found");
  if (!canTransitionAaxRelease(current.release_status, to)) throw new Error(`Invalid AAX release transition: ${current.release_status} -> ${to}`);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { release_status: to, updated_at: now };
  if (to === "available") update.available_at = current.scheduled_release_at && new Date(current.scheduled_release_at).getTime() <= Date.now() ? current.scheduled_release_at : now;
  if (to === "scheduled" && !current.scheduled_release_at) throw new Error("A scheduled release requires scheduled_release_at");
  const { data, error } = await admin.from("aax_models").update(update).eq("id", modelId).select().single();
  if (error) throw new Error(error.message);
  await admin.from("audit_logs").insert({ actor_id: actorId, action: "aax.release.transition", target_type: "aax_model", target_id: modelId, metadata: { from: current.release_status, to, note: note ?? null, model_key: current.model_key } });
  return data;
}
