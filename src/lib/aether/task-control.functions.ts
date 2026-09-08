/**
 * AETHER TASK CONTROL — cancel & retry
 * Ownership enforced. Never overwrites previous runs.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createRun, transitionTaskStatus, transitionRunStatus } from "./task-service";
import { buildRetryPayload } from "./approvals";
import type { TaskStatus } from "./task-runtime";

async function loadOwnedTask(
  admin: any,
  taskId: string,
  userId: string,
  isAdmin: boolean,
) {
  let q = admin.from("tasks").select("*").eq("id", taskId);
  if (!isAdmin) q = q.eq("owner_id", userId);
  const { data: task, error } = await q.single();
  if (error || !task) throw new Error("Task not found or access denied");
  return task;
}

export const cancelTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string }) => {
    if (!data?.taskId) throw new Error("taskId required");
    return { taskId: String(data.taskId) };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const task = await loadOwnedTask(supabaseAdmin, data.taskId, context.userId, Boolean(isAdmin));

    const cancellable: TaskStatus[] = ["queued", "running", "paused", "retrying", "scheduled", "waiting_approval"];
    if (!cancellable.includes(task.status as TaskStatus)) {
      return { ok: false as const, message: `Cannot cancel a task in status "${task.status}"` };
    }

    await transitionTaskStatus(supabaseAdmin, data.taskId, task.status as TaskStatus, "cancelled");

    // Cancel any open runs
    const { data: openRuns } = await supabaseAdmin
      .from("task_runs")
      .select("id, status")
      .eq("task_id", data.taskId)
      .in("status", ["queued", "running", "paused", "retrying", "waiting_approval"]);

    for (const run of openRuns ?? []) {
      try {
        await transitionRunStatus(supabaseAdmin, run.id, run.status as TaskStatus, "cancelled");
      } catch {
        // best-effort
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "task.cancelled",
      target_type: "tasks",
      target_id: data.taskId,
    });

    return { ok: true as const, message: "Task cancelled" };
  });

export const retryTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string; reason?: string }) => {
    if (!data?.taskId) throw new Error("taskId required");
    return {
      taskId: String(data.taskId),
      reason: data.reason?.trim().slice(0, 500) || undefined,
    };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const task = await loadOwnedTask(supabaseAdmin, data.taskId, context.userId, Boolean(isAdmin));

    if (task.status !== "failed" && task.status !== "cancelled" && task.status !== "completed") {
      return { ok: false as const, message: `Cannot retry a task in status "${task.status}"` };
    }

    // Find latest run to link as retry_of
    const { data: latestRuns } = await supabaseAdmin
      .from("task_runs")
      .select("id, attempt, inputs, agent_key")
      .eq("task_id", data.taskId)
      .order("attempt", { ascending: false })
      .limit(1);

    const previous = latestRuns?.[0];
    const nextAttempt = (previous?.attempt ?? 0) + 1;

    const retryMeta = buildRetryPayload(previous?.id ?? "", data.reason, context.userId);

    // Reset task to queued
    await supabaseAdmin
      .from("tasks")
      .update({
        status: "queued",
        progress: 0,
        completed_at: null,
        updated_at: new Date().toISOString(),
        detail: { ...(task.detail as object), last_retry: retryMeta },
      })
      .eq("id", data.taskId);

    const run = await createRun(supabaseAdmin, {
      task_id: data.taskId,
      owner_id: task.owner_id,
      agent_key: previous?.agent_key ?? undefined,
      inputs: previous?.inputs ?? {},
      attempt: nextAttempt,
      retry_of: previous?.id ?? null,
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "task.retried",
      target_type: "tasks",
      target_id: data.taskId,
      metadata: { new_run_id: run.id, previous_run_id: previous?.id, reason: data.reason ?? null },
    });

    return {
      ok: true as const,
      message: "Retry created",
      taskId: data.taskId,
      runId: run.id,
      attempt: nextAttempt,
    };
  });
