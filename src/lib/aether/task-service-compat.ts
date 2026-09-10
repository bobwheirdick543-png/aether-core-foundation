import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleRunRetry, transitionRunStatus, transitionTaskStatus } from "./task-service";
import type { TaskStatus } from "./task-runtime";

export const transitionTask = transitionTaskStatus;
export const transitionRun = transitionRunStatus;

export async function recoverExpiredRuntimeWork(admin: SupabaseClient, limit = 100): Promise<number> {
  const { data: runs, error } = await admin.from("task_runs")
    .select("id,task_id,retry_count,max_retries")
    .eq("status", "running")
    .lt("lease_expires_at", new Date().toISOString())
    .order("lease_expires_at", { ascending: true })
    .limit(Math.max(1, Math.min(500, limit)));
  if (error) throw new Error(error.message);
  let recovered = 0;
  for (const run of runs ?? []) {
    const retryCount = Number(run.retry_count ?? 0);
    if (retryCount < Number(run.max_retries ?? 3)) {
      await scheduleRunRetry(admin, run.task_id, run.id, "Runtime lease expired; execution recovered for retry", "worker_lease_expired", retryCount);
    } else {
      const now = new Date().toISOString();
      await admin.from("task_runs").update({ status: "failed", failure_code: "worker_lease_expired", retryable: false, error: "Runtime lease expired and retry budget was exhausted", ended_at: now, updated_at: now }).eq("id", run.id).eq("status", "running");
      await admin.from("tasks").update({ status: "failed", last_error_code: "worker_lease_expired", last_error_message: "Runtime lease expired and retry budget was exhausted", dead_lettered_at: now, updated_at: now }).eq("id", run.task_id).eq("status", "running");
    }
    recovered += 1;
  }
  return recovered;
}

export type { TaskStatus };
