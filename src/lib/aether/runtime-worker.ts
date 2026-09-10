/**
 * AETHER UNIVERSAL RUNTIME WORKER
 *
 * Generic worker loop for every long-running subsystem. It claims durable work
 * from Supabase, executes a registered domain handler, heartbeats its lease and
 * records terminal state. The worker is deliberately independent of the UI.
 *
 * A deployment may invoke this worker repeatedly (cron/worker process). A task's
 * durable deadline is separate from an individual worker invocation, so closing
 * a browser cannot cancel queued work.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { appendTaskEvent, heartbeatRuntimeRun, recoverExpiredRuntimeWork, transitionRunStatus, transitionTaskStatus } from "./task-service";
import { isDeadlineExceeded, isRetryableFailure, type TaskStatus } from "./task-runtime";
import { executeResearchStep } from "./executor";

export interface ClaimedRuntimeWork {
  task_id: string;
  run_id: string;
  owner_id: string;
  project_id: string | null;
  task_status: TaskStatus;
  run_status: TaskStatus;
  attempt: number;
  task_kind: string;
  task_detail: Record<string, unknown>;
  inputs: Record<string, unknown>;
  timeout_ms: number;
  deadline_at: string | null;
}

export interface RuntimeWorkerOptions {
  workerId: string;
  leaseSeconds?: number;
  recoveryLimit?: number;
}

function errorCode(error: unknown): string {
  if (error instanceof Error && /permission|forbidden/i.test(error.message)) return "permission_denied";
  if (error instanceof Error && /invalid|required|validation/i.test(error.message)) return "invalid_input";
  if (error instanceof Error && /timeout|timed out|deadline/i.test(error.message)) return "timeout_budget_exhausted";
  return "worker_execution_failed";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2000) : "Worker execution failed";
}

export async function claimNextRuntimeWork(admin: SupabaseClient, options: RuntimeWorkerOptions): Promise<ClaimedRuntimeWork | null> {
  const { data, error } = await admin.rpc("claim_next_runtime_run", {
    p_worker_id: options.workerId,
    p_lease_seconds: options.leaseSeconds ?? 60,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ClaimedRuntimeWork | undefined) ?? null;
}

async function cancellationState(admin: SupabaseClient, taskId: string, runId: string): Promise<"none" | "cancelled" | "timeout"> {
  const [{ data: task }, { data: run }] = await Promise.all([
    admin.from("tasks").select("cancel_requested_at, deadline_at").eq("id", taskId).single(),
    admin.from("task_runs").select("cancel_requested_at, deadline_at").eq("id", runId).single(),
  ]);
  if (task?.cancel_requested_at || run?.cancel_requested_at) return "cancelled";
  if (isDeadlineExceeded(task?.deadline_at) || isDeadlineExceeded(run?.deadline_at)) return "timeout";
  return "none";
}

async function executeClaimedWork(admin: SupabaseClient, work: ClaimedRuntimeWork, workerId: string): Promise<void> {
  const initialState = await cancellationState(admin, work.task_id, work.run_id);
  if (initialState === "cancelled") {
    await transitionRunStatus(admin, work.run_id, "running", "cancelled", { failureCode: "cancelled", retryable: false, workerId });
    await transitionTaskStatus(admin, work.task_id, "running", "cancelled", { workerId });
    return;
  }
  if (initialState === "timeout") {
    await transitionRunStatus(admin, work.run_id, "running", "failed", { failureCode: "timeout_budget_exhausted", retryable: false, workerId });
    await transitionTaskStatus(admin, work.task_id, "running", "failed", { workerId });
    await admin.from("tasks").update({ last_error_code: "timeout_budget_exhausted", last_error_message: "Task runtime deadline exceeded", dead_lettered_at: new Date().toISOString() }).eq("id", work.task_id);
    return;
  }

  await appendTaskEvent(admin, { taskId: work.task_id, runId: work.run_id, eventType: "worker.execution_started",
    fromStatus: "running", toStatus: "running", message: `Worker ${workerId} started ${work.task_kind}`, data: { attempt: work.attempt }, workerId });

  const started = Date.now();
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  try {
    heartbeatTimer = setInterval(() => {
      void heartbeatRuntimeRun(admin, work.run_id, workerId, 60).catch(() => undefined);
    }, 20_000);

    if (work.task_kind === "research") {
      const urls = Array.isArray(work.task_detail.urls) ? work.task_detail.urls.filter((v): v is string => typeof v === "string") : [];
      const topic = typeof work.task_detail.topic === "string" ? work.task_detail.topic : undefined;
      const result = await executeResearchStep(admin, {
        taskId: work.task_id, runId: work.run_id, ownerId: work.owner_id, urls, topic,
        deadlineAt: work.deadline_at ?? undefined, workerId,
      });
      if (result.status === "cancelled") return;
      return;
    }

    throw new Error(`No runtime handler registered for task kind "${work.task_kind}"`);
  } catch (error) {
    const code = errorCode(error);
    const message = errorMessage(error);
    const retryable = isRetryableFailure(code);
    const elapsed = Date.now() - started;
    await admin.from("task_runs").update({ duration_ms: elapsed }).eq("id", work.run_id).eq("worker_id", workerId);
    if (retryable) {
      const { data: run } = await admin.from("task_runs").select("retry_count, max_retries").eq("id", work.run_id).single();
      if ((run?.retry_count ?? 0) < (run?.max_retries ?? 3)) {
        const { scheduleRunRetry } = await import("./task-service");
        await scheduleRunRetry(admin, work.task_id, work.run_id, message, code, run?.retry_count ?? 0);
        return;
      }
    }
    await transitionRunStatus(admin, work.run_id, "running", "failed", { error: message, failureCode: code, retryable, workerId });
    await transitionTaskStatus(admin, work.task_id, "running", "failed", { progress: 0, workerId });
    await admin.from("tasks").update({ last_error_code: code, last_error_message: message, dead_lettered_at: retryable ? new Date().toISOString() : null }).eq("id", work.task_id);
    if (retryable) {
      await admin.from("task_dead_letters").insert({ task_id: work.task_id, run_id: work.run_id, owner_id: work.owner_id,
        reason: "retry_budget_exhausted", failure_code: code, error_message: message, payload: { attempt: work.attempt } }).then(() => undefined);
      await appendTaskEvent(admin, { taskId: work.task_id, runId: work.run_id, eventType: "run.dead_lettered", fromStatus: "running", toStatus: "failed",
        message: "Retry budget exhausted", data: { failure_code: code, elapsed_ms: elapsed }, workerId });
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    await admin.from("runtime_workers").update({ status: "idle", current_run_id: null, last_heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("worker_id", workerId);
  }
}

export async function runNextRuntimeWork(admin: SupabaseClient, options: RuntimeWorkerOptions): Promise<{ claimed: boolean; taskId?: string; runId?: string; recovered?: number }> {
  const recovered = await recoverExpiredRuntimeWork(admin, options.recoveryLimit ?? 100);
  const work = await claimNextRuntimeWork(admin, options);
  if (!work) return { claimed: false, recovered };
  await executeClaimedWork(admin, work, options.workerId);
  return { claimed: true, taskId: work.task_id, runId: work.run_id, recovered };
}

export { recoverExpiredRuntimeWork };
