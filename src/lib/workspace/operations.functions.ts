import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { data: tasks, error } = await context.supabase.from("tasks").select("id, title, kind, status, progress, detail, priority, started_at, completed_at, heartbeat_at, worker_id, retry_count, max_retries, last_error_code, last_error_message, created_at, updated_at").eq("user_id", uid).order("updated_at", { ascending: false }).limit(100);
    if (error) throw new Error(`Could not load operations: ${error.message}`);
    const ids = (tasks ?? []).map((task) => task.id);
    if (!ids.length) return [];
    const { data: runs } = await context.supabase.from("task_runs").select("id, task_id, agent_id, agent_key, attempt, status, started_at, ended_at, heartbeat_at, worker_id, retry_count, failure_code, retryable, duration_ms, inputs, outputs, error, created_at, updated_at, aax_model_id").eq("owner_id", uid).in("task_id", ids).order("created_at", { ascending: false }).limit(500);
    const { data: events } = await context.supabase.from("task_events").select("id, task_id, run_id, sequence, event_type, from_status, to_status, message, data, actor_id, worker_id, created_at").in("task_id", ids).order("created_at", { ascending: false }).limit(1000);
    return (tasks ?? []).map((task) => ({ ...task, runs: (runs ?? []).filter((run) => run.task_id === task.id), events: (events ?? []).filter((event) => event.task_id === task.id).slice(0, 30) }));
  });

export const getAdminOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: role } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Forbidden");
    const { data: tasks, error } = await supabaseAdmin.from("tasks").select("id, user_id, title, kind, status, progress, detail, priority, started_at, completed_at, heartbeat_at, worker_id, retry_count, max_retries, last_error_code, last_error_message, created_at, updated_at").order("updated_at", { ascending: false }).limit(250);
    if (error) throw new Error(`Could not load operations: ${error.message}`);
    const ids = (tasks ?? []).map((task) => task.id);
    const runsResult = ids.length ? await supabaseAdmin.from("task_runs").select("id, task_id, owner_id, agent_id, agent_key, attempt, status, started_at, ended_at, heartbeat_at, worker_id, retry_count, failure_code, retryable, duration_ms, outputs, error, created_at, updated_at, aax_model_id").in("task_id", ids).order("created_at", { ascending: false }).limit(1000) : { data: [] as any[] };
    const eventsResult = ids.length ? await supabaseAdmin.from("task_events").select("id, task_id, run_id, sequence, event_type, from_status, to_status, message, data, actor_id, worker_id, created_at").in("task_id", ids).order("created_at", { ascending: false }).limit(2000) : { data: [] as any[] };
    return (tasks ?? []).map((task) => ({ ...task, runs: (runsResult.data ?? []).filter((run) => run.task_id === task.id), events: (eventsResult.data ?? []).filter((event) => event.task_id === task.id).slice(0, 30) }));
  });

export const getMyOperation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ context, data }) => {
    if (!data.id) throw new Error("Operation id required");
    const { data: task, error } = await context.supabase.from("tasks").select("*").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (error || !task) return null;
    const [{ data: runs }, { data: events }] = await Promise.all([
      context.supabase.from("task_runs").select("*").eq("task_id", data.id).eq("owner_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("task_events").select("*").eq("task_id", data.id).order("sequence", { ascending: true }).limit(1000),
    ]);
    return { task, runs: runs ?? [], events: events ?? [] };
  });
