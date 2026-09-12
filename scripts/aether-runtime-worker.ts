/**
 * AETHER DURABLE RUNTIME WORKER
 *
 * Long-running server process for Phase A. Supabase is the durable queue and
 * source of truth. The worker leases work, sends heartbeats, dispatches only
 * registered domain executors, and records terminal truth. Browser lifetime is
 * never part of task execution.
 */

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { executeResearchStep } from "../src/lib/aether/executor";
import { heartbeatRuntimeRun } from "../src/lib/aether/task-service";

const WORKER_ID = process.env.AETHER_WORKER_ID?.trim() || `aether-worker-${randomUUID()}`;
const LEASE_SECONDS = clampInt(process.env.AETHER_WORKER_LEASE_SECONDS, 60, 10, 300);
const POLL_MS = clampInt(process.env.AETHER_WORKER_POLL_MS, 1000, 250, 30000);
const RECOVERY_MS = clampInt(process.env.AETHER_WORKER_RECOVERY_MS, 10000, 1000, 120000);
const HEARTBEAT_MS = Math.min(Math.max(1000, Math.floor((LEASE_SECONDS * 1000) / 3)), 30000);

let stopping = false;
let activeRunId: string | null = null;

function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
}

function requireRuntimeEnvironment(): void {
  for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`Missing required runtime environment variable: ${key}`);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 10);
}

async function recoverExpiredWork(): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("requeue_expired_runtime_work", { p_limit: 100 });
  if (error) throw new Error(`Runtime recovery failed: ${error.message}`);
  if (Number(data ?? 0) > 0) console.info(`[Aether worker ${WORKER_ID}] recovered ${data} expired run(s)`);
}

async function claimNextRun(): Promise<any | null> {
  const { data, error } = await supabaseAdmin.rpc("claim_next_runtime_run", {
    p_worker_id: WORKER_ID,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) throw new Error(`Runtime claim failed: ${error.message}`);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function markWorker(status: "idle" | "running" | "draining" | "offline"): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("runtime_workers").upsert({
    worker_id: WORKER_ID,
    status,
    current_run_id: status === "idle" || status === "offline" ? null : activeRunId,
    last_heartbeat_at: now,
    metadata: { runtime: "phase-a", pid: process.pid },
    updated_at: now,
  });
  if (error) throw new Error(`Worker status update failed: ${error.message}`);
}

async function scheduleRetryIfNeeded(taskId: string, runId: string): Promise<void> {
  const { data: run, error } = await supabaseAdmin.from("task_runs")
    .select("status, retryable, error")
    .eq("id", runId)
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) throw new Error(`Failed to inspect runtime failure: ${error.message}`);
  if (run?.status !== "failed" || run.retryable !== true) return;

  const { data: newRunId, error: retryError } = await supabaseAdmin.rpc("schedule_runtime_retry", {
    p_task_id: taskId,
    p_run_id: runId,
    p_reason: run.error ?? "Runtime execution failed",
  });
  if (retryError) throw new Error(`Failed to schedule runtime retry: ${retryError.message}`);
  if (newRunId) console.info(`[Aether worker ${WORKER_ID}] scheduled retry ${newRunId} for ${runId}`);
}

async function failUnsupportedClaim(taskId: string, runId: string, taskKind: string): Promise<void> {
  const message = `No registered runtime executor for task kind: ${taskKind}`;
  const now = new Date().toISOString();
  const { error: runError } = await supabaseAdmin.from("task_runs").update({
    status: "failed", failure_code: "unsupported_runtime_task", retryable: false,
    error: message, ended_at: now, worker_id: null, lease_expires_at: null,
    heartbeat_at: null, updated_at: now,
  }).eq("id", runId).eq("worker_id", WORKER_ID).eq("status", "running");
  if (runError) throw new Error(`Failed to finalize unsupported run: ${runError.message}`);

  const { error: taskError } = await supabaseAdmin.from("tasks").update({
    status: "failed", last_error_code: "unsupported_runtime_task",
    last_error_message: message, completed_at: now, worker_id: null,
    lease_expires_at: null, heartbeat_at: null, updated_at: now,
  }).eq("id", taskId).eq("worker_id", WORKER_ID).eq("status", "running");
  if (taskError) throw new Error(`Failed to finalize unsupported task: ${taskError.message}`);

  const { error: eventError } = await supabaseAdmin.rpc("append_task_event", {
    p_task_id: taskId,
    p_run_id: runId,
    p_event_type: "run.failed",
    p_from_status: "running",
    p_to_status: "failed",
    p_message: message,
    p_data: { failure_code: "unsupported_runtime_task" },
    p_worker_id: WORKER_ID,
  });
  if (eventError) throw new Error(`Failed to record runtime failure event: ${eventError.message}`);
}

async function executeClaim(claim: any): Promise<void> {
  const taskId = String(claim.task_id);
  const runId = String(claim.run_id);
  const ownerId = String(claim.owner_id);
  const detail = claim.task_detail && typeof claim.task_detail === "object" ? claim.task_detail : {};
  const inputs = claim.inputs && typeof claim.inputs === "object" ? claim.inputs : {};
  const topic = asString((detail as any).topic) ?? asString((inputs as any).topic) ?? asString((inputs as any).query);
  const urls = asUrls((detail as any).urls ?? (inputs as any).urls);

  activeRunId = runId;
  await markWorker("running");

  let heartbeatFailures = 0;
  const heartbeatTimer = setInterval(() => {
    void heartbeatRuntimeRun(supabaseAdmin, runId, WORKER_ID, LEASE_SECONDS)
      .then(() => { heartbeatFailures = 0; })
      .catch((error: unknown) => {
        heartbeatFailures += 1;
        console.error(`[Aether worker ${WORKER_ID}] heartbeat failed (${heartbeatFailures}):`, error);
        if (heartbeatFailures >= 3) stopping = true;
      });
  }, HEARTBEAT_MS);

  try {
    const taskKind = String(claim.task_kind);
    if (taskKind !== "research") {
      await failUnsupportedClaim(taskId, runId, taskKind);
      return;
    }

    await executeResearchStep(supabaseAdmin, {
      taskId,
      runId,
      ownerId,
      projectId: claim.project_id ?? null,
      urls,
      topic,
      deadlineAt: claim.deadline_at ?? undefined,
      workerId: WORKER_ID,
    });

    // The domain executor owns the immediate result; the worker owns retry
    // scheduling when that result is explicitly retryable.
    await scheduleRetryIfNeeded(taskId, runId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Aether worker ${WORKER_ID}] execution error for ${runId}: ${message}`);

    const now = new Date().toISOString();
    const { data: current, error: loadError } = await supabaseAdmin.from("task_runs")
      .select("status")
      .eq("id", runId)
      .eq("worker_id", WORKER_ID)
      .maybeSingle();
    if (loadError) throw new Error(`Failed to inspect failed runtime run: ${loadError.message}`);

    if (current?.status === "running") {
      const { error: runError } = await supabaseAdmin.from("task_runs").update({
        status: "failed", failure_code: "worker_execution_error", retryable: true,
        error: message, ended_at: now, worker_id: null, lease_expires_at: null,
        heartbeat_at: null, updated_at: now,
      }).eq("id", runId).eq("worker_id", WORKER_ID).eq("status", "running");
      if (runError) throw new Error(`Failed to finalize worker error: ${runError.message}`);

      const { error: taskError } = await supabaseAdmin.from("tasks").update({
        status: "failed", last_error_code: "worker_execution_error",
        last_error_message: message, completed_at: now, worker_id: null,
        lease_expires_at: null, heartbeat_at: null, updated_at: now,
      }).eq("id", taskId).eq("worker_id", WORKER_ID).eq("status", "running");
      if (taskError) throw new Error(`Failed to finalize worker task error: ${taskError.message}`);

      const { error: eventError } = await supabaseAdmin.rpc("append_task_event", {
        p_task_id: taskId,
        p_run_id: runId,
        p_event_type: "run.failed",
        p_from_status: "running",
        p_to_status: "failed",
        p_message: message,
        p_data: { failure_code: "worker_execution_error", retryable: true },
        p_worker_id: WORKER_ID,
      });
      if (eventError) throw new Error(`Failed to record worker failure event: ${eventError.message}`);
    }

    await scheduleRetryIfNeeded(taskId, runId);
  } finally {
    clearInterval(heartbeatTimer);
    activeRunId = null;
    if (!stopping) await markWorker("idle");
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  requireRuntimeEnvironment();
  console.info(`[Aether worker ${WORKER_ID}] started; lease=${LEASE_SECONDS}s poll=${POLL_MS}ms heartbeat=${HEARTBEAT_MS}ms`);
  await markWorker("idle");
  let nextRecoveryAt = 0;

  while (!stopping) {
    try {
      const now = Date.now();
      if (now >= nextRecoveryAt) {
        await recoverExpiredWork();
        nextRecoveryAt = now + RECOVERY_MS;
      }

      const claim = await claimNextRun();
      if (claim) await executeClaim(claim);
      else await sleep(POLL_MS);
    } catch (error: unknown) {
      console.error(`[Aether worker ${WORKER_ID}] loop error:`, error);
      await sleep(Math.min(POLL_MS * 2, 10000));
    }
  }

  await markWorker("offline");
  console.info(`[Aether worker ${WORKER_ID}] stopped`);
}

function requestStop(signal: string): void {
  if (stopping) return;
  console.info(`[Aether worker ${WORKER_ID}] received ${signal}; draining`);
  stopping = true;
}

process.on("SIGTERM", () => requestStop("SIGTERM"));
process.on("SIGINT", () => requestStop("SIGINT"));

if (process.argv.includes("--check")) {
  requireRuntimeEnvironment();
  console.log("Aether Phase A runtime worker configuration is valid.");
} else {
  await run();
}
