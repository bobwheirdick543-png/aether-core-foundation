import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Response("Unable to verify administrator authorization", { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const listAdminModelConfigs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.userId);
  const [{ data: aax, error: aaxError }, { data: roles, error: rolesError }] = await Promise.all([
    supabaseAdmin.from("aax_models").select("id,model_key,display_name,generation,revision,description,provider,provider_model,capabilities,specializations,context_window,output_limit,release_status,scheduled_release_at,available_at,disabled_at,config,parent_model_id,improvements,specialization_profile,updated_at").order("generation").order("revision"),
    supabaseAdmin.from("model_configs").select("id,role_key,display_name,description,provider,provider_model,capabilities,context_window,speed,status,sort_order,updated_at").order("sort_order").order("role_key"),
  ]);
  if (aaxError || rolesError) throw new Response("Could not load model configuration", { status: 500 });
  return { aax: aax ?? [], roles: roles ?? [] };
});

export const updateAdminAaxModel = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { id: string; provider?: string | null; providerModel?: string | null; contextWindow?: number; outputLimit?: number | null; releaseStatus?: "draft" | "scheduled" | "announced" | "available"; scheduledReleaseAt?: string | null; disabled?: boolean; config?: Record<string, unknown> }) => data).handler(async ({ context, data }) => {
  await assertAdmin(context.userId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.provider !== undefined) patch.provider = data.provider?.trim() || null;
  if (data.providerModel !== undefined) patch.provider_model = data.providerModel?.trim() || null;
  if (data.contextWindow !== undefined) patch.context_window = Math.min(10_000_000, Math.max(256, Math.floor(data.contextWindow)));
  if (data.outputLimit !== undefined) patch.output_limit = data.outputLimit == null ? null : Math.min(1_000_000, Math.max(1, Math.floor(data.outputLimit)));
  if (data.releaseStatus !== undefined) patch.release_status = data.releaseStatus;
  if (data.scheduledReleaseAt !== undefined) patch.scheduled_release_at = data.scheduledReleaseAt;
  if (data.disabled !== undefined) patch.disabled_at = data.disabled ? new Date().toISOString() : null;
  if (data.config !== undefined) patch.config = data.config;
  const { data: model, error } = await supabaseAdmin.from("aax_models").update(patch).eq("id", data.id).select("id,model_key,provider,provider_model,context_window,output_limit,release_status,scheduled_release_at,available_at,disabled_at,config,updated_at").single();
  if (error || !model) throw new Response(`Could not update AAX model: ${error?.message ?? "not found"}`, { status: 500 });
  await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "aax.model.policy.updated", target_type: "aax_models", target_id: data.id, metadata: { changed: Object.keys(data).filter((key) => key !== "id") } });
  return model;
});

export const updateAdminModelRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { id: string; provider?: string | null; providerModel?: string | null; contextWindow?: number; speed?: string | null; status?: string }) => data).handler(async ({ context, data }) => {
  await assertAdmin(context.userId);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.provider !== undefined) patch.provider = data.provider?.trim() || null;
  if (data.providerModel !== undefined) patch.provider_model = data.providerModel?.trim() || null;
  if (data.contextWindow !== undefined) patch.context_window = Math.min(10_000_000, Math.max(256, Math.floor(data.contextWindow)));
  if (data.speed !== undefined) patch.speed = data.speed?.trim() || null;
  if (data.status !== undefined) patch.status = data.status.trim().slice(0, 40);
  const { data: role, error } = await supabaseAdmin.from("model_configs").update(patch).eq("id", data.id).select("id,role_key,provider,provider_model,context_window,speed,status,updated_at").single();
  if (error || !role) throw new Response(`Could not update model role: ${error?.message ?? "not found"}`, { status: 500 });
  await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "model.role.policy.updated", target_type: "model_configs", target_id: data.id, metadata: { changed: Object.keys(data).filter((key) => key !== "id") } });
  return role;
});
