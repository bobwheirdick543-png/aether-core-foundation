import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

const TRANSITIONS: Record<string, string[]> = {
  draft: ["training", "retired"],
  training: ["evaluation", "draft", "retired"],
  evaluation: ["approved", "training", "draft", "retired"],
  approved: ["scheduled", "announced", "available", "deprecated", "retired"],
  scheduled: ["announced", "approved", "retired"],
  announced: ["available", "scheduled", "deprecated", "retired"],
  available: ["deprecated", "retired"],
  deprecated: ["available", "retired"],
  retired: [],
};

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}

async function transitionModel(
  supabase: SupabaseClient,
  actorId: string,
  modelId: string,
  nextStatus: string,
  extra: Record<string, unknown> = {},
) {
  const { data: model, error: loadError } = await supabase
    .from("aax_models")
    .select("id, model_key, display_name, release_status, provider, provider_model, scheduled_release_at, available_at")
    .eq("id", modelId)
    .single();
  if (loadError || !model) throw new Error("AAX model not found");

  if (!TRANSITIONS[model.release_status]?.includes(nextStatus)) {
    throw new Error(`Invalid AAX lifecycle transition: ${model.release_status} → ${nextStatus}`);
  }
  if ((nextStatus === "scheduled" || nextStatus === "announced") && !extra.scheduled_release_at && !model.scheduled_release_at) {
    throw new Error("A scheduled release time is required");
  }
  if (nextStatus === "available" && !model.provider_model) {
    throw new Error("AAX model cannot be released without a configured provider model");
  }

  const patch: Record<string, unknown> = { release_status: nextStatus, updated_at: new Date().toISOString() };
  if (extra.scheduled_release_at) patch.scheduled_release_at = extra.scheduled_release_at;
  if (nextStatus === "available") patch.available_at = extra.available_at ?? new Date().toISOString();
  if (nextStatus === "deprecated" || nextStatus === "retired") patch.disabled_at = new Date().toISOString();
  if (nextStatus === "available" || nextStatus === "announced" || nextStatus === "scheduled") patch.disabled_at = null;

  const { error } = await supabase.from("aax_models").update(patch).eq("id", modelId);
  if (error) throw new Error(error.message);

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action: `aax.model.${nextStatus}`,
    target_type: "aax_model",
    target_id: modelId,
    metadata: {
      model_key: model.model_key,
      previous_status: model.release_status,
      next_status: nextStatus,
      ...extra,
    },
  });
  if (auditError) throw new Error(auditError.message);

  return { modelId, modelKey: model.model_key, status: nextStatus };
}

export const updateAaxLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const input = data as { modelId: string; status: string; scheduledReleaseAt?: string | null; availableAt?: string | null };
    if (!input?.modelId || !input.status) throw new Error("Model and lifecycle status are required");
    return transitionModel(context.supabase as unknown as SupabaseClient, context.userId, input.modelId, input.status, {
      scheduled_release_at: input.scheduledReleaseAt ?? undefined,
      available_at: input.availableAt ?? undefined,
    });
  });

export const retireAaxModel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const input = data as { modelId: string };
    return transitionModel(context.supabase as unknown as SupabaseClient, context.userId, input.modelId, "retired");
  });
