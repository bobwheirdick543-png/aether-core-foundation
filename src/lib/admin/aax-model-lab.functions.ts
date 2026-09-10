import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAaxAdmin, listAaxTrainingJobs, getAaxTrainingJob } from "./aax-model-lab.server";
import { transitionAaxRelease, type AaxReleaseState } from "@/lib/aether/aax-release-control";

async function getAdminClient(context: { supabase: Parameters<typeof assertAaxAdmin>[0]; userId: string }) {
  await assertAaxAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getAaxModelLabJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await getAdminClient(context);
  return listAaxTrainingJobs(admin);
});

export const getAaxModelLabJob = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((input: { jobId: string }) => input).handler(async ({ context, data }) => {
  if (!data.jobId) throw new Error("jobId is required");
  const admin = await getAdminClient(context);
  return getAaxTrainingJob(admin, data.jobId);
});

export const transitionAaxModelRelease = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { modelId: string; state: AaxReleaseState; note?: string }) => input).handler(async ({ context, data }) => {
  if (!data.modelId) throw new Error("modelId is required");
  const admin = await getAdminClient(context);
  return transitionAaxRelease(admin, data.modelId, data.state, context.userId, data.note);
});

export const configureAaxModel = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input: { modelId: string; provider?: string | null; providerModel?: string | null; capabilities?: string[]; specializations?: string[]; specializationProfile?: Record<string, unknown>; outputLimit?: number | null; contextWindow?: number; description?: string }) => input).handler(async ({ context, data }) => {
  if (!data.modelId) throw new Error("modelId is required");
  const admin = await getAdminClient(context);
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.provider !== undefined) update.provider = data.provider;
  if (data.providerModel !== undefined) update.provider_model = data.providerModel;
  if (data.capabilities !== undefined) update.capabilities = data.capabilities;
  if (data.specializations !== undefined) update.specializations = data.specializations;
  if (data.specializationProfile !== undefined) update.specialization_profile = data.specializationProfile;
  if (data.outputLimit !== undefined) update.output_limit = data.outputLimit;
  if (data.contextWindow !== undefined) update.context_window = data.contextWindow;
  if (data.description !== undefined) update.description = data.description;
  const { data: model, error } = await admin.from("aax_models").update(update).eq("id", data.modelId).select().single();
  if (error) throw new Error(error.message);
  await admin.from("audit_logs").insert({ actor_id: context.userId, action: "aax.model.configure", target_type: "aax_model", target_id: data.modelId, metadata: update });
  return model;
});
