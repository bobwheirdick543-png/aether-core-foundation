/**
 * ADMIN CONTROL PLANE data. Every function re-checks the admin role server-side
 * through has_role(); navigation visibility is never treated as authorization.
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

/** Real platform counters + real audit trail. No fabricated numbers. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [users, admins, projects, conversations, tasks, activeTasks, runs, research, knowledge, approvedKnowledge, reports, apiKeys, agents] =
      await Promise.all([
        countOf(supabaseAdmin, "profiles"),
        countOf(supabaseAdmin, "user_roles", (q: any) => q.eq("role", "admin")),
        countOf(supabaseAdmin, "projects"),
        countOf(supabaseAdmin, "conversations"),
        countOf(supabaseAdmin, "tasks"),
        countOf(supabaseAdmin, "tasks", (q: any) => q.in("status", ["queued", "running"])),
        countOf(supabaseAdmin, "task_runs"),
        countOf(supabaseAdmin, "research_runs"),
        countOf(supabaseAdmin, "knowledge_entries"),
        countOf(supabaseAdmin, "knowledge_entries", (q: any) => q.eq("stage", "production")),
        countOf(supabaseAdmin, "reports"),
        countOf(supabaseAdmin, "api_keys", (q: any) => q.eq("status", "active")),
        countOf(supabaseAdmin, "agents"),
      ]);

    const { data: audit } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, actor_id, target_type, target_id, created_at")
      .order("created_at", { ascending: false })
      .limit(12);

    return {
      counts: {
        users,
        admins,
        projects,
        conversations,
        tasks,
        activeTasks,
        runs,
        research,
        knowledge,
        approvedKnowledge,
        reports,
        apiKeys,
        agents,
      },
      audit: audit ?? [],
    };
  });

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, created_at, onboarding_completed")
      .order("created_at", { ascending: false })
      .limit(200);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });

    const emailById = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    const lastSignIn = new Map((list?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]));

    return (profiles ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      email: emailById.get(p.id) ?? null,
      createdAt: p.created_at,
      lastSignInAt: lastSignIn.get(p.id) ?? null,
      onboarded: p.onboarding_completed,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

/** TEAM: the internal agent workforce with real permissions and real telemetry. */
export const getTeamOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: agents }, { data: permissions }, { data: runs }] = await Promise.all([
      supabaseAdmin
        .from("agents")
        .select("id, agent_key, name, description, purpose, status, tools, last_activity_at")
        .order("name"),
      supabaseAdmin.from("agent_permissions").select("agent_id, permission, allowed, requires_approval"),
      supabaseAdmin.from("task_runs").select("agent_id, status, started_at, ended_at").limit(1000),
    ]);

    const team = (agents ?? []).map((a) => {
      const mine = (runs ?? []).filter((r) => r.agent_id === a.id);
      const finished = mine.filter((r) => r.ended_at && r.started_at);
      const succeeded = mine.filter((r) => r.status === "completed").length;
      const failed = mine.filter((r) => r.status === "failed").length;
      const avgMs =
        finished.length > 0
          ? Math.round(
              finished.reduce(
                (sum, r) => sum + (new Date(r.ended_at!).getTime() - new Date(r.started_at!).getTime()),
                0,
              ) / finished.length,
            )
          : null;
      return {
        ...a,
        permissions: (permissions ?? []).filter((p) => p.agent_id === a.id),
        telemetry: {
          totalRuns: mine.length,
          succeeded,
          failed,
          avgDurationMs: avgMs,
          hasData: mine.length > 0,
        },
      };
    });

    return { team, totalRuns: (runs ?? []).length };
  });

export const getAdminActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, actor_id, target_type, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
