import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getAdminAaxIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: models, error: modelError }, { data: stats }, { data: register }] = await Promise.all([
      supabaseAdmin.from("aax_models").select("id, model_key, display_name, generation, revision, description, provider, provider_model, capabilities, specializations, context_window, output_limit, release_status, scheduled_release_at, available_at, updated_at").order("generation", { ascending: true }).order("revision", { ascending: true }),
      supabaseAdmin.from("ai_stat_current").select("entity_id, metric_key, value, updated_at").eq("entity_type", "aax_model"),
      supabaseAdmin.from("ai_stat_register").select("id, entity_id, metric_key, previous_value, delta, new_value, reason, task_id, run_id, knowledge_event_id, evaluation_id, created_at").eq("entity_type", "aax_model").order("created_at", { ascending: false }).limit(500),
    ]);
    if (modelError) throw new Response("Could not load AAX intelligence", { status: 500 });
    const byModel = new Map<string, Array<{ metric_key: string; value: string; updated_at: string }>>();
    for (const row of stats ?? []) {
      const list = byModel.get(row.entity_id) ?? [];
      list.push({ metric_key: row.metric_key, value: String(row.value), updated_at: row.updated_at });
      byModel.set(row.entity_id, list);
    }
    return {
      models: (models ?? []).map((model) => ({ ...model, statistics: byModel.get(model.id) ?? [], registerEntries: (register ?? []).filter((entry) => entry.entity_id === model.id) })),
      registerCount: register?.length ?? 0,
    };
  });

export const getAdminAgentIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: agents, error }, { data: stats }, { data: register }] = await Promise.all([
      supabaseAdmin.from("agents").select("id, agent_key, name, description, purpose, status, tools, last_activity_at").order("name"),
      supabaseAdmin.from("ai_stat_current").select("entity_id, metric_key, value, updated_at").eq("entity_type", "agent"),
      supabaseAdmin.from("ai_stat_register").select("id, entity_id, metric_key, previous_value, delta, new_value, reason, task_id, run_id, knowledge_event_id, evaluation_id, created_at").eq("entity_type", "agent").order("created_at", { ascending: false }).limit(500),
    ]);
    if (error) throw new Response("Could not load agent intelligence", { status: 500 });
    const byAgent = new Map<string, Array<{ metric_key: string; value: string; updated_at: string }>>();
    for (const row of stats ?? []) {
      const list = byAgent.get(row.entity_id) ?? [];
      list.push({ metric_key: row.metric_key, value: String(row.value), updated_at: row.updated_at });
      byAgent.set(row.entity_id, list);
    }
    return { agents: (agents ?? []).map((agent) => ({ ...agent, statistics: byAgent.get(agent.id) ?? [], registerEntries: (register ?? []).filter((entry) => entry.entity_id === agent.id) })) };
  });
