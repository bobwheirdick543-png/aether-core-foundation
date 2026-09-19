import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Response("Unable to verify administrator authorization", { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const updateAdminAaxModel = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { id: string; provider?: string | null; providerModel?: string | null; contextWindow?: number; outputLimit?: number | null; releaseStatus?: "draft" | "scheduled" | "announced" | "available"; scheduledReleaseAt?: string | null; disabled?: boolean; config?: Record<string, unknown> }) => data).handler(async ({ context, data }) => {
  await assertAdmin(context.userId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.provider !== undefined) patch.provider = data.provider?.trim() || null;
  if (data.providerModel !== undefined) patch.provider_model = data.providerModel?.trim() || null;
  if (data.contextWindow !== undefined) patch.context_window = Math.min(10_000_000, Math.max(256, Math.floor(data.contextWindow)));
  if (data.outputLimit !== undefined) patch.output_limit = data.outputLimit == null ? null : Math.min(1_000_000, Math.max(1, Math.floor(data.outputLimit)));
  if (data.releaseStatus !== undefined) patch.release_status = data.releaseStatus;
  const now = new Date().toISOString();
  if (data.scheduledReleaseAt !== undefined) patch.scheduled_release_at = data.scheduledReleaseAt;
  if (data.releaseStatus !== undefined) {
    if (data.releaseStatus === "available") {
      // Saving an available generation is an immediate global release. The availability timestamp is persisted so every selector and API authorization path sees the same release state.
      patch.available_at = now;
      patch.scheduled_release_at = null;
    } else if (data.releaseStatus !== "scheduled") {
      patch.available_at = null;
    }
  }
  if (data.disabled !== undefined) patch.disabled_at = data.disabled ? now : null;
  if (data.releaseStatus === "available" && data.disabled === true) patch.available_at = now;
  if (data.config !== undefined) patch.config = data.config;
  const { data: model, error } = await supabaseAdmin.from("aax_models").update(patch).eq("id", data.id).select("id,model_key,provider,provider_model,context_window,output_limit,release_status,scheduled_release_at,available_at,disabled_at,config,updated_at").single();
  if (error || !model) throw new Response(`Could not update AAX model: ${error?.message ?? "not found"}`, { status: 500 });
  await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "aax.model.policy.updated", target_type: "aax_models", target_id: data.id, metadata: { changed: Object.keys(data).filter((key) => key !== "id") } });
  return model;
});
