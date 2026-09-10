import type { SupabaseClient } from "@supabase/supabase-js";

export const AAX_RELEASE_STATES = ["DRAFT","TRAINING","EVALUATION","APPROVED","SCHEDULED","ANNOUNCED","AVAILABLE","DEPRECATED","RETIRED"] as const;
export type AaxReleaseState = typeof AAX_RELEASE_STATES[number];

export function isAaxReleased(status: string, availableAt: string | null | undefined, now = new Date()) {
  if (status !== "AVAILABLE") return false;
  return !availableAt || new Date(availableAt).getTime() <= now.getTime();
}

export async function assertAaxCanRun(admin: SupabaseClient, modelKey: string) {
  const { data, error } = await admin.rpc("get_available_aax_model", { p_model_key: modelKey });
  if (error) throw new Error(error.message);
  const model = Array.isArray(data) ? data[0] : data;
  if (!model) throw new Error("AAX model is not released or is not available yet");
  return model;
}
