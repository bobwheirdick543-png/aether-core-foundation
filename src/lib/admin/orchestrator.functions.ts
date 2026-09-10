import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const saveOrchestratorConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { config: Record<string, unknown>; changeNote?: string }) => ({
    config: data?.config ?? {},
    changeNote: String(data?.changeNote ?? "").trim().slice(0, 1000),
  }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin(supabaseAdmin, context.userId);
    const { data: latest } = await supabaseAdmin.from("orchestrator_configs").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
    const version = Number(latest?.version ?? 0) + 1;
    const { data: row, error } = await supabaseAdmin.from("orchestrator_configs").insert({ version, status: "draft", config: data.config, change_note: data.changeNote || null, created_by: context.userId }).select("*").single();
    if (error || !row) throw new Error(error?.message || "Could not save orchestrator configuration");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "orchestrator.config.created", target_type: "orchestrator_config", target_id: row.id, metadata: { version, change_note: data.changeNote || null } });
    return row;
  });

export const activateOrchestratorConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { configId: string }) => ({ configId: String(data?.configId ?? "").trim() }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin(supabaseAdmin, context.userId);
    if (!data.configId) throw new Error("Configuration ID is required");
    const { data: row, error } = await supabaseAdmin.from("orchestrator_configs").select("id, version, status").eq("id", data.configId).maybeSingle();
    if (error || !row) throw new Error("Configuration not found");
    await supabaseAdmin.from("orchestrator_configs").update({ status: "rolled_back", rolled_back_at: new Date().toISOString(), rolled_back_by: context.userId }).eq("status", "active");
    const { data: active, error: activateError } = await supabaseAdmin.from("orchestrator_configs").update({ status: "active", activated_at: new Date().toISOString() }).eq("id", row.id).eq("status", row.status).select("*").single();
    if (activateError || !active) throw new Error(activateError?.message || "Could not activate configuration");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "orchestrator.config.activated", target_type: "orchestrator_config", target_id: row.id, metadata: { version: row.version } });
    return active;
  });
