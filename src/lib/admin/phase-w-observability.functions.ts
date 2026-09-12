import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
  return supabaseAdmin;
}

export const getPhaseWObservability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context.userId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const [workers, tasks, runs, events, spans, recentErrors, metrics] = await Promise.all([
      db.from("runtime_workers").select("worker_id,status,current_run_id,last_heartbeat_at,metadata,updated_at").order("updated_at", { ascending: false }).limit(100),
      db.from("tasks").select("id,status,kind,priority,created_at,started_at,completed_at,heartbeat_at,retry_count,max_retries,last_error_code").order("updated_at", { ascending: false }).limit(500),
      db.from("task_runs").select("id,task_id,status,attempt,started_at,ended_at,duration_ms,retry_count,retryable,failure_code,worker_id,agent_key,aax_model_id,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(1000),
      db.from("aether_observability_events").select("id,occurred_at,level,component,event_type,message,trace_id,request_id,span_id,user_id,task_id,run_id,worker_id,agent_key,model_id,duration_ms,success,retryable,error_code,metadata").gte("occurred_at", since).order("occurred_at", { ascending: false }).limit(250),
      db.from("aether_observability_spans").select("id,trace_id,span_id,parent_span_id,name,component,status,started_at,ended_at,duration_ms,task_id,run_id,worker_id,error_code,attributes").gte("started_at", since).order("started_at", { ascending: false }).limit(500),
      db.from("aether_observability_events").select("id,occurred_at,level,component,event_type,message,trace_id,task_id,run_id,error_code").eq("level", "error").gte("occurred_at", recentSince).order("occurred_at", { ascending: false }).limit(100),
      db.from("aether_observability_metric_samples").select("id,metric_name,value,unit,sampled_at,component,trace_id,request_id,task_id,run_id,dimensions").gte("sampled_at", since).order("sampled_at", { ascending: false }).limit(500),
    ]);

    const allTasks = tasks.data ?? [];
    const allRuns = runs.data ?? [];
    const allEvents = events.data ?? [];
    const failedRuns = allRuns.filter((run) => run.status === "failed");
    const completedRuns = allRuns.filter((run) => run.status === "completed");
    const durations = allRuns.map((run) => run.duration_ms).filter((value): value is number => typeof value === "number" && value >= 0);
    const queuePending = allTasks.filter((task) => ["queued", "pending", "retrying"].includes(task.status)).length;
    const activeTasks = allTasks.filter((task) => ["running", "waiting_approval", "paused", "retrying"].includes(task.status)).length;
    const offlineWorkers = (workers.data ?? []).filter((worker) => worker.status === "offline");
    const retryingRuns = allRuns.filter((run) => run.status === "retrying" || run.retryable === true).length;
    const retryAttempts = allRuns.filter((run) => Number(run.attempt ?? 1) > 1).length;
    const approvalEvents = allEvents.filter((event) => /approval/i.test(event.event_type));
    const approvals = approvalEvents.filter((event) => /approved|approve/i.test(event.event_type)).length;
    const rejections = approvalEvents.filter((event) => /rejected|reject/i.test(event.event_type)).length;
    const avgDurationMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    const alerts: Array<{ severity: "warning" | "critical"; code: string; message: string; count: number }> = [];
    if (offlineWorkers.length) alerts.push({ severity: "critical", code: "workers_offline", message: "One or more registered runtime workers are offline.", count: offlineWorkers.length });
    if (queuePending >= 50) alerts.push({ severity: "warning", code: "queue_backlog", message: "Durable runtime queue has a significant backlog.", count: queuePending });
    if ((recentErrors.data ?? []).length >= 10) alerts.push({ severity: "critical", code: "error_spike", message: "At least ten error events occurred in the last fifteen minutes.", count: recentErrors.data?.length ?? 0 });
    if (retryingRuns >= 10) alerts.push({ severity: "warning", code: "retry_pressure", message: "Retry activity is elevated in the observed window.", count: retryingRuns });

    return {
      window: { since, recentSince },
      health: {
        workers: workers.data?.length ?? 0,
        offlineWorkers: offlineWorkers.length,
        queuePending,
        activeTasks,
        avgDurationMs,
        runs: allRuns.length,
        completedRuns: completedRuns.length,
        failedRuns: failedRuns.length,
        successRate: allRuns.length ? completedRuns.length / allRuns.length : null,
        failureRate: allRuns.length ? failedRuns.length / allRuns.length : null,
        retryingRuns,
        retryAttempts,
        approvalEvents: approvalEvents.length,
        approvals,
        rejections,
        eventCount: allEvents.length,
      },
      workers: workers.data ?? [],
      events: allEvents,
      spans: spans.data ?? [],
      metrics: metrics.data ?? [],
      recentErrors: recentErrors.data ?? [],
      alerts,
    };
  });
