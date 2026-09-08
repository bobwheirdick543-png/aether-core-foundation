/**
 * USER WORKSPACE data. Everything here runs as the signed-in user, so row level
 * security guarantees a user can only ever read their own resources.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWorkspaceSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const uid = context.userId;

    const [projects, conversations, tasks, reports, research, knowledge] = await Promise.all([
      sb
        .from("projects")
        .select("id, name, slug, description, project_type, status, updated_at")
        .eq("owner_id", uid)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(6),
      sb
        .from("conversations")
        .select("id, title, model_role, updated_at")
        .eq("user_id", uid)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(6),
      sb
        .from("tasks")
        .select("id, title, kind, status, progress, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(6),
      sb
        .from("reports")
        .select("id, title, topic, approval_status, created_at")
        .eq("owner_id", uid)
        .order("created_at", { ascending: false })
        .limit(6),
      sb
        .from("research_runs")
        .select("id, topic, status, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(6),
      sb
        .from("knowledge_entries")
        .select("id, title, stage, confidence, updated_at")
        .eq("owner_id", uid)
        .order("updated_at", { ascending: false })
        .limit(6),
    ]);

    return {
      projects: projects.data ?? [],
      conversations: conversations.data ?? [],
      tasks: tasks.data ?? [],
      reports: reports.data ?? [],
      research: research.data ?? [],
      knowledge: knowledge.data ?? [],
    };
  });

export const getMyTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: tasks } = await context.supabase
      .from("tasks")
      .select("id, title, kind, status, progress, created_at, started_at, completed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: runs } = await context.supabase
      .from("task_runs")
      .select("id, task_id, attempt, status, started_at, ended_at, error")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(300);

    return (tasks ?? []).map((t) => ({
      ...t,
      runs: (runs ?? []).filter((r) => r.task_id === t.id),
    }));
  });

/**
 * Create a real Task + initial Run record.
 * Status is queued. No fake completion, no invented agent output.
 * A background worker (future slice) will execute runs.
 */
export const createMyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { title: string; kind?: string }) => {
    const title = String(data?.title ?? "").trim().slice(0, 200);
    if (title.length < 2) throw new Error("Title is required.");
    const kind = String(data?.kind ?? "general").trim().slice(0, 64) || "general";
    return { title, kind };
  })
  .handler(async ({ context, data }) => {
    const { data: task, error } = await context.supabase
      .from("tasks")
      .insert({
        user_id: context.userId,
        title: data.title,
        kind: data.kind,
        status: "queued",
        progress: 0,
        detail: { source: "user.create" },
      })
      .select("id, title, kind, status, progress, created_at")
      .single();

    if (error || !task) {
      return { ok: false as const, message: "Could not create task." };
    }

    // Initial run attempt — queued only. No fabricated execution.
    await context.supabase.from("task_runs").insert({
      task_id: task.id,
      owner_id: context.userId,
      attempt: 1,
      status: "queued",
      inputs: { title: data.title, kind: data.kind },
      outputs: {},
      idempotency_key: `task:${task.id}:attempt:1`,
    });

    return { ok: true as const, task };
  });

export const cancelMyTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ context, data }) => {
    if (!data.id) return { ok: false as const, message: "Task id required." };

    const { data: updated, error } = await context.supabase
      .from("tasks")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["queued", "running", "waiting_approval"])
      .select("id")
      .maybeSingle();

    if (error || !updated) {
      return { ok: false as const, message: "Task could not be cancelled." };
    }

    await context.supabase
      .from("task_runs")
      .update({ status: "cancelled", ended_at: new Date().toISOString() })
      .eq("task_id", data.id)
      .eq("owner_id", context.userId)
      .in("status", ["queued", "running"]);

    return { ok: true as const };
  });

export const getMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("id, title, body, event_type, link, status, read_at, created_at")
      .eq("recipient_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_id", context.userId);
    return { ok: !error };
  });
