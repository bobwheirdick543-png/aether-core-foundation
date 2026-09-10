import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRun, createTask } from "@/lib/aether/task-service";

async function assertAdmin(supabase: SupabaseClient, userId: string) { const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" }); if (!data) throw new Response("Forbidden", { status: 403 }); }

export const createAaxTrainingJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context, data }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
  const input = data as { targetModelId: string; sourceType: string; originalSource: string; sourceHash?: string; sourceId?: string; sourceMetadata?: Record<string, unknown>; timeoutMs?: number };
  if (!input.targetModelId || !input.sourceType || !input.originalSource?.trim()) throw new Response("Target AAX and original source are required", { status: 400 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: model, error: modelError } = await supabaseAdmin.from("aax_models").select("id, model_key, provider, provider_model").eq("id", input.targetModelId).single();
  if (modelError || !model) throw new Response("Target AAX model not found", { status: 404 });
  if (!model.provider || !model.provider_model) throw new Response("Target AAX is not provider-configured", { status: 409 });
  const timeoutMs = input.timeoutMs ?? 30 * 60 * 1000;
  const { data: job, error: jobError } = await supabaseAdmin.from("aax_training_jobs").insert({ target_model_id: input.targetModelId, source_type: input.sourceType, source_id: input.sourceId ?? null, source_hash: input.sourceHash ?? null, original_source_ref: input.sourceMetadata ?? {}, original_source_content: input.originalSource, source_metadata: input.sourceMetadata ?? {}, pipeline_status: "queued", current_stage: "queued", timeout_ms: timeoutMs, completed_agents: [], requested_by: context.userId }).select("id").single();
  if (jobError || !job) throw new Response(jobError?.message ?? "Could not create AAX training job", { status: 500 });
  const task = await createTask(supabaseAdmin, { owner_id: context.userId, title: `AAX knowledge evolution — ${model.model_key}`, kind: "aax-training", detail: { training_job_id: job.id }, timeout_ms: timeoutMs, idempotency_key: `aax-training:${job.id}` });
  const run = await createRun(supabaseAdmin, { task_id: task.id, owner_id: context.userId, inputs: { training_job_id: job.id }, timeout_ms: timeoutMs, max_retries: 3, idempotency_key: `aax-training-run:${job.id}` });
  return { trainingJobId: job.id, taskId: task.id, runId: run.id };
});

export const getAdminAaxTrainingJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId); const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("aax_training_jobs").select("id, target_model_id, source_type, source_hash, pipeline_status, current_stage, completed_agents, target_self_analysis, report_delivery, started_at, completed_at, last_event_at, created_at, updated_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Response("Could not load AAX training jobs", { status: 500 }); return { jobs: data ?? [] };
});

export const getAdminAaxIntelligence = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId); const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: models, error: modelError }, { data: stats }, { data: register }] = await Promise.all([
    supabaseAdmin.from("aax_models").select("id, model_key, display_name, generation, revision, description, provider, provider_model, capabilities, specializations, context_window, output_limit, release_status, scheduled_release_at, available_at, parent_model_id, improvements, specialization_profile, updated_at").order("generation", { ascending: true }).order("revision", { ascending: true }),
    supabaseAdmin.from("ai_stat_current").select("entity_id, metric_key, value, updated_at").eq("entity_type", "aax_model"),
    supabaseAdmin.from("ai_stat_register").select("id, entity_id, metric_key, previous_value, delta, new_value, reason, task_id, run_id, knowledge_event_id, evaluation_id, created_at").eq("entity_type", "aax_model").order("created_at", { ascending: false }).limit(500),
  ]);
  if (modelError) throw new Response("Could not load AAX intelligence", { status: 500 });
  const byModel = new Map<string, Array<{ metric_key: string; value: string; updated_at: string }>>(); for (const row of stats ?? []) { const list = byModel.get(row.entity_id) ?? []; list.push({ metric_key: row.metric_key, value: String(row.value), updated_at: row.updated_at }); byModel.set(row.entity_id, list); }
  return { models: (models ?? []).map((model) => ({ ...model, statistics: byModel.get(model.id) ?? [], registerEntries: (register ?? []).filter((entry) => entry.entity_id === model.id) })), registerCount: register?.length ?? 0 };
});

export const getAdminAgentIntelligence = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId); const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: agents, error }, { data: stats }, { data: register }] = await Promise.all([
    supabaseAdmin.from("agents").select("id, agent_key, name, description, purpose, status, tools, last_activity_at").order("name"),
    supabaseAdmin.from("ai_stat_current").select("entity_id, metric_key, value, updated_at").eq("entity_type", "agent"),
    supabaseAdmin.from("ai_stat_register").select("id, entity_id, metric_key, previous_value, delta, new_value, reason, task_id, run_id, knowledge_event_id, evaluation_id, created_at").eq("entity_type", "agent").order("created_at", { ascending: false }).limit(500),
  ]);
  if (error) throw new Response("Could not load agent intelligence", { status: 500 }); const byAgent = new Map<string, Array<{ metric_key: string; value: string; updated_at: string }>>(); for (const row of stats ?? []) { const list = byAgent.get(row.entity_id) ?? []; list.push({ metric_key: row.metric_key, value: String(row.value), updated_at: row.updated_at }); byAgent.set(row.entity_id, list); }
  return { agents: (agents ?? []).map((agent) => ({ ...agent, statistics: byAgent.get(agent.id) ?? [], registerEntries: (register ?? []).filter((entry) => entry.entity_id === agent.id) })) };
});
