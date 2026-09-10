/**
 * ADMIN CONTROL PLANE data. Every function re-checks the admin role server-side.
 * Navigation visibility is never treated as authorization.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

async function countOf(admin: any, table: string, filter?: (q: any) => any) {
  let q = admin.from(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

export const getAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [users, admins, projects, conversations, tasks, activeTasks, runs, research, knowledge, approvedKnowledge, reports, apiKeys, agents, models] = await Promise.all([
    countOf(supabaseAdmin, "profiles"), countOf(supabaseAdmin, "user_roles", (q: any) => q.eq("role", "admin")),
    countOf(supabaseAdmin, "projects"), countOf(supabaseAdmin, "conversations"), countOf(supabaseAdmin, "tasks"),
    countOf(supabaseAdmin, "tasks", (q: any) => q.in("status", ["queued", "running"])), countOf(supabaseAdmin, "task_runs"),
    countOf(supabaseAdmin, "research_runs"), countOf(supabaseAdmin, "knowledge_entries"), countOf(supabaseAdmin, "knowledge_entries", (q: any) => q.eq("stage", "production")),
    countOf(supabaseAdmin, "reports"), countOf(supabaseAdmin, "api_keys", (q: any) => q.eq("status", "active")), countOf(supabaseAdmin, "agents"), countOf(supabaseAdmin, "model_configs"),
  ]);
  const { data: audit } = await supabaseAdmin.from("audit_logs").select("id, action, actor_id, target_type, target_id, created_at").order("created_at", { ascending: false }).limit(12);
  return { counts: { users, admins, projects, conversations, tasks, activeTasks, runs, research, knowledge, approvedKnowledge, reports, apiKeys, agents, models }, audit: audit ?? [] };
});

export const getAdminModels = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("model_configs").select("role_key, display_name, description, provider, provider_model, capabilities, context_window, speed, status, sort_order").order("sort_order").order("role_key");
  if (error) throw new Response("Could not load model catalog", { status: 500 });
  const { data: metrics } = await supabaseAdmin.from("model_productivity_metrics").select("model_role, productivity_percent, request_count, completed_count, failed_count, retried_count, evaluated_count, window_end").order("window_end", { ascending: false }).limit(100);
  const latest = new Map<string, any>();
  for (const metric of metrics ?? []) if (!latest.has(metric.model_role)) latest.set(metric.model_role, metric);
  return { models: (data ?? []).map((model) => ({ ...model, productivity: latest.get(model.role_key) ?? null })) };
});

export const getAdminUsers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, display_name, created_at, onboarding_completed").order("created_at", { ascending: false }).limit(200);
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const emailById = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const lastSignIn = new Map((list?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));
  return (profiles ?? []).map((p) => ({ id: p.id, displayName: p.display_name, email: emailById.get(p.id) ?? null, createdAt: p.created_at, lastSignInAt: lastSignIn.get(p.id) ?? null, onboarded: p.onboarding_completed, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string) }));
});

export const getTeamOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: agents }, { data: permissions }, { data: runs }, { data: metrics }] = await Promise.all([
    supabaseAdmin.from("agents").select("id, agent_key, name, description, purpose, status, tools, last_activity_at").order("name"),
    supabaseAdmin.from("agent_permissions").select("agent_id, permission, allowed, requires_approval"),
    supabaseAdmin.from("task_runs").select("agent_id, agent_key, status, retry_count, started_at, ended_at").limit(5000),
    supabaseAdmin.from("agent_productivity_metrics").select("agent_key, productivity_percent, completed_count, failed_count, retried_count, evaluated_count, source_run_count, window_end").order("window_end", { ascending: false }).limit(5000),
  ]);
  const latestMetric = new Map<string, any>();
  for (const metric of metrics ?? []) if (!latestMetric.has(metric.agent_key)) latestMetric.set(metric.agent_key, metric);
  const team = (agents ?? []).map((a) => {
    const mine = (runs ?? []).filter((r) => r.agent_id === a.id || r.agent_key === a.agent_key);
    const finished = mine.filter((r) => r.ended_at && r.started_at);
    const succeeded = mine.filter((r) => r.status === "completed").length;
    const failed = mine.filter((r) => r.status === "failed").length;
    const retried = mine.filter((r) => Number(r.retry_count ?? 0) > 0).length;
    const avgMs = finished.length ? Math.round(finished.reduce((sum, r) => sum + (new Date(r.ended_at!).getTime() - new Date(r.started_at!).getTime()), 0) / finished.length) : null;
    return { ...a, permissions: (permissions ?? []).filter((p) => p.agent_id === a.id), productivity: latestMetric.get(a.agent_key) ?? null, telemetry: { totalRuns: mine.length, succeeded, failed, retried, avgDurationMs: avgMs, hasData: mine.length > 0 } };
  });
  return { team, totalRuns: (runs ?? []).length };
});

export const getAgentWorkspace = createServerFn({ method: "GET" }).inputValidator((data: { agentKey: string }) => {
  const agentKey = String(data?.agentKey ?? "").trim().slice(0, 100);
  if (!agentKey) throw new Error("Agent key is required.");
  return { agentKey };
}).middleware([requireSupabaseAuth]).handler(async ({ context, data }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: agent, error: agentError } = await supabaseAdmin.from("agents").select("id, agent_key, name, description, purpose, status, tools, config, last_activity_at, created_at, updated_at").eq("agent_key", data.agentKey).maybeSingle();
  if (agentError || !agent) throw new Response("Agent not found", { status: 404 });
  const [{ data: permissions }, { data: runs }, { data: tasks }, { data: productivity }, { data: conversations }] = await Promise.all([
    supabaseAdmin.from("agent_permissions").select("permission, allowed, requires_approval").eq("agent_id", agent.id).order("permission"),
    supabaseAdmin.from("task_runs").select("id, task_id, owner_id, attempt, status, started_at, ended_at, inputs, outputs, error, retry_of, created_at, updated_at, agent_key").eq("agent_id", agent.id).order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("tasks").select("id, user_id, project_id, title, kind, status, progress, detail, started_at, completed_at, created_at, updated_at, agent_key").eq("agent_key", agent.agent_key).order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("agent_productivity_metrics").select("*").eq("agent_key", agent.agent_key).order("window_end", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("agent_conversations").select("id, title, archived, last_message_at, created_at, updated_at").eq("owner_id", context.userId).eq("agent_key", agent.agent_key).order("updated_at", { ascending: false }),
  ]);
  const finishedRuns = (runs ?? []).filter((r) => r.ended_at && r.started_at);
  const avgDurationMs = finishedRuns.length ? Math.round(finishedRuns.reduce((sum, r) => sum + (new Date(r.ended_at!).getTime() - new Date(r.started_at!).getTime()), 0) / finishedRuns.length) : null;
  return { agent, permissions: permissions ?? [], tasks: tasks ?? [], runs: runs ?? [], conversations: conversations ?? [], productivity: productivity ?? null, telemetry: { totalRuns: runs?.length ?? 0, succeeded: (runs ?? []).filter((r) => r.status === "completed").length, failed: (runs ?? []).filter((r) => r.status === "failed").length, waiting: (runs ?? []).filter((r) => r.status === "waiting_approval").length, avgDurationMs } };
});

export const getAdminActivity = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("audit_logs").select("id, action, actor_id, target_type, target_id, metadata, created_at").order("created_at", { ascending: false }).limit(200);
  return data ?? [];
});

export const getOrchestratorConfigHistory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("orchestrator_configs").select("*").order("version", { ascending: false });
  if (error) throw new Response("Could not load orchestrator configuration", { status: 500 });
  return data ?? [];
});
