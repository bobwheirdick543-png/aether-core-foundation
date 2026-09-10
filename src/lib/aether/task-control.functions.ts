/**
 * AETHER UNIVERSAL TASK CONTROL — cancel / pause / resume / retry.
 * Ownership is enforced server-side. Running cancellation is durable and
 * cooperative: the worker observes cancel_requested_at and stops safely.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createRun, transitionTaskStatus, transitionRunStatus, appendTaskEvent } from "./task-service";
import type { TaskStatus } from "./task-runtime";

async function loadOwnedTask(admin: any, taskId: string, userId: string, isAdmin: boolean) {
  let q = admin.from("tasks").select("*").eq("id", taskId);
  if (!isAdmin) q = q.eq("user_id", userId);
  const { data: task, error } = await q.single();
  if (error || !task) throw new Error("Task not found or access denied");
  return task;
}

async function isAdmin(context: any): Promise<boolean> {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return Boolean(data);
}

export const cancelTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string; reason?: string }) => {
    if (!data?.taskId) throw new Error("taskId required");
    return { taskId: String(data.taskId), reason: data.reason?.trim().slice(0, 500) || "Cancelled by requester" };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const task = await loadOwnedTask(supabaseAdmin, data.taskId, context.userId, await isAdmin(context));
    const status = task.status as TaskStatus;
    if (!["queued", "running", "paused", "retrying", "scheduled", "waiting_approval"].includes(status)) return { ok: false as const, message: `Cannot cancel a task in status "${status}"` };

    if (status === "running") {
      const now = new Date().toISOString();
      const { error } = await supabaseAdmin.from("tasks").update({ cancel_requested_at: now, cancellation_reason: data.reason, updated_at: now }).eq("id", data.taskId).eq("user_id", task.user_id);
      if (error) throw new Error(error.message);
      const { data: runs } = await supabaseAdmin.from("task_runs").select("id").eq("task_id", data.taskId).eq("status", "running");
      for (const run of runs ?? []) await supabaseAdmin.from("task_runs").update({ cancel_requested_at: now, cancellation_reason: data.reason, updated_at: now }).eq("id", run.id);
      await appendTaskEvent(supabaseAdmin, { taskId: data.taskId, eventType: "task.cancel_requested", fromStatus: "running", toStatus: "running", message: data.reason, data: { requested_at: now }, actorId: context.userId });
      return { ok: true as const, message: "Cancellation requested" };
    }

    await transitionTaskStatus(supabaseAdmin, data.taskId, status, "cancelled", { actorId: context.userId });
    const { data: openRuns } = await supabaseAdmin.from("task_runs").select("id, status").eq("task_id", data.taskId).in("status", ["queued", "paused", "retrying", "scheduled", "waiting_approval"]);
    for (const run of openRuns ?? []) {
      try { await transitionRunStatus(supabaseAdmin, run.id, run.status as TaskStatus, "cancelled", { actorId: context.userId }); } catch { /* another worker may have moved it */ }
    }
    return { ok: true as const, message: "Task cancelled" };
  });

export const pauseTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string }) => {
    if (!data?.taskId) throw new Error("taskId required");
    return { taskId: String(data.taskId) };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const task = await loadOwnedTask(supabaseAdmin, data.taskId, context.userId, await isAdmin(context));
    const status = task.status as TaskStatus;
    if (!["queued", "running", "waiting_approval", "scheduled"].includes(status)) return { ok: false as const, message: `Cannot pause a task in status "${status}"` };
    await transitionTaskStatus(supabaseAdmin, data.taskId, status, "paused", { actorId: context.userId });
    const { data: runs } = await supabaseAdmin.from("task_runs").select("id, status").eq("task_id", data.taskId).in("status", ["queued", "running", "waiting_approval", "scheduled"]);
    for (const run of runs ?? []) {
      try { await transitionRunStatus(supabaseAdmin, run.id, run.status as TaskStatus, "paused", { actorId: context.userId }); } catch { /* state may have changed concurrently */ }
    }
    return { ok: true as const, message: "Task paused" };
  });

export const resumeTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string }) => {
    if (!data?.taskId) throw new Error("taskId required");
    return { taskId: String(data.taskId) };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const task = await loadOwnedTask(supabaseAdmin, data.taskId, context.userId, await isAdmin(context));
    if (task.status !== "paused") return { ok: false as const, message: `Cannot resume a task in status "${task.status}"` };
    await transitionTaskStatus(supabaseAdmin, data.taskId, "paused", "queued", { actorId: context.userId });
    const { data: runs } = await supabaseAdmin.from("task_runs").select("id, status").eq("task_id", data.taskId).eq("status", "paused");
    for (const run of runs ?? []) {
      try { await transitionRunStatus(supabaseAdmin, run.id, "paused", "queued", { actorId: context.userId }); } catch { /* state may have changed concurrently */ }
    }
    return { ok: true as const, message: "Task resumed" };
  });

export const retryTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string; reason?: string }) => {
    if (!data?.taskId) throw new Error("taskId required");
    return { taskId: String(data.taskId), reason: data.reason?.trim().slice(0, 500) || undefined };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const task = await loadOwnedTask(supabaseAdmin, data.taskId, context.userId, await isAdmin(context));
    if (!["failed", "cancelled", "completed"].includes(task.status)) return { ok: false as const, message: `Cannot retry a task in status "${task.status}"` };
    const { data: latestRuns } = await supabaseAdmin.from("task_runs").select("id, attempt, inputs, agent_key, timeout_ms, max_retries").eq("task_id", data.taskId).order("attempt", { ascending: false }).limit(1);
    const previous = latestRuns?.[0];
    const nextAttempt = (previous?.attempt ?? 0) + 1;
    const { error: resetError } = await supabaseAdmin.from("tasks").update({ status: "queued", progress: 0, completed_at: null, dead_lettered_at: null,
      cancel_requested_at: null, cancellation_reason: null, retry_count: nextAttempt - 1, next_attempt_at: null,
      last_error_code: null, last_error_message: null, updated_at: new Date().toISOString(),
      detail: { ...(task.detail as object), last_retry: { previous_run_id: previous?.id ?? null, reason: data.reason ?? null, requested_by: context.userId } } }).eq("id", data.taskId);
    if (resetError) throw new Error(resetError.message);
    const run = await createRun(supabaseAdmin, { task_id: data.taskId, owner_id: task.user_id, agent_key: previous?.agent_key ?? undefined,
      inputs: previous?.inputs ?? {}, attempt: nextAttempt, retry_of: previous?.id ?? null, timeout_ms: previous?.timeout_ms ?? task.timeout_ms,
      max_retries: previous?.max_retries ?? task.max_retries });
    await appendTaskEvent(supabaseAdmin, { taskId: data.taskId, runId: run.id, eventType: "task.retry_created", fromStatus: task.status, toStatus: "queued",
      message: "New execution attempt created", data: { new_run_id: run.id, previous_run_id: previous?.id ?? null, attempt: nextAttempt, reason: data.reason ?? null }, actorId: context.userId });
    return { ok: true as const, message: "Retry created", taskId: data.taskId, runId: run.id, attempt: nextAttempt };
  });
