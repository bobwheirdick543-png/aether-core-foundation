import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;

export async function updateMyZ2ApiKeyPolicy(ownerId: string, keyId: string, patch: {
  name?: string;
  applicationName?: string;
  environment?: "development" | "test" | "production";
  modelKey?: string;
  expiresAt?: string | null;
  rateLimitPerMinute?: number;
  maxTokensPerRequest?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  allowWebResearch?: boolean;
  allowStreaming?: boolean;
}) {
  const { data: current, error: currentError } = await db.from("aether_api_keys")
    .select("id,owner_id,api_kind,model_key,metadata,status")
    .eq("id", keyId).eq("owner_id", ownerId).eq("api_kind", "aax").maybeSingle();
  if (currentError || !current) throw new Response("API key not found", { status: 404 });
  if (current.status === "revoked") throw new Response("Revoked API keys cannot be edited", { status: 409 });

  let modelPatch: Record<string, unknown> = {};
  if (patch.modelKey && patch.modelKey !== current.model_key) {
    const { data: model, error } = await db.from("aax_models")
      .select("id,model_key,generation,revision")
      .eq("model_key", patch.modelKey).eq("release_status", "available").is("disabled_at", null)
      .or("available_at.is.null,available_at.lte." + new Date().toISOString()).maybeSingle();
    if (error || !model) throw new Response("Selected AAX model is not currently available", { status: 409 });
    modelPatch = { model_id: model.id, model_key: model.model_key, model_generation: model.generation, model_revision: model.revision };
  }

  const metadata = {
    ...(current.metadata ?? {}),
    ...(patch.allowWebResearch === undefined ? {} : { allowWebResearch: patch.allowWebResearch }),
    ...(patch.allowStreaming === undefined ? {} : { allowStreaming: patch.allowStreaming }),
  };
  const update: Record<string, unknown> = {
    ...modelPatch,
    metadata,
    ...(patch.name === undefined ? {} : { name: patch.name.trim().slice(0, 120) }),
    ...(patch.applicationName === undefined ? {} : { application_name: patch.applicationName.trim().slice(0, 160) }),
    ...(patch.environment === undefined ? {} : { environment: patch.environment }),
    ...(patch.expiresAt === undefined ? {} : { expires_at: patch.expiresAt }),
    ...(patch.rateLimitPerMinute === undefined ? {} : { rate_limit_per_minute: Math.min(10000, Math.max(1, Math.floor(patch.rateLimitPerMinute))) }),
    ...(patch.maxTokensPerRequest === undefined ? {} : { max_tokens_per_request: Math.min(100000, Math.max(1, Math.floor(patch.maxTokensPerRequest))) }),
    ...(patch.maxInputTokens === undefined ? {} : { max_input_tokens: Math.min(1000000, Math.max(1, Math.floor(patch.maxInputTokens))) }),
    ...(patch.maxOutputTokens === undefined ? {} : { max_output_tokens: Math.min(100000, Math.max(1, Math.floor(patch.maxOutputTokens))) }),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db.from("aether_api_keys").update(update).eq("id", keyId).eq("owner_id", ownerId)
    .select("id,owner_id,name,application_name,environment,model_key,model_generation,model_revision,expires_at,rate_limit_per_minute,monthly_token_limit,unlimited_tokens,max_tokens_per_request,max_input_tokens,max_output_tokens,status,metadata,updated_at").single();
  if (error || !data) throw new Error(`Could not update API key policy: ${error?.message ?? "unknown error"}`);
  await db.from("aether_api_key_events").insert({
    api_key_id: keyId, owner_id: ownerId, actor_id: ownerId, event_type: "updated", action_source: "user",
    metadata: { patch: Object.keys(patch) },
  });
  return data;
}
