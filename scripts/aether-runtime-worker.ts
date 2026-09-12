/**
 * AETHER DURABLE RUNTIME WORKER
 * Supabase is the durable queue/source of truth. Workers lease work,
 * heartbeat while executing, dispatch registered executors, and recover
 * expired work without losing task state.
 */
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { executeResearchStep, executeKnowledgeAcquisitionRuntimeStep } from "../src/lib/aether/executor";
import { heartbeatRuntimeRun } from "../src/lib/aether/task-service";
import { createObservabilityContext, recordObservabilityEvent, startObservabilitySpan } from "../src/lib/aether/observability";

const WORKER_ID = process.env.AETHER_WORKER_ID?.trim() || `aether-worker-${randomUUID()}`;
const LEASE_SECONDS = clampInt(process.env.AETHER_WORKER_LEASE_SECONDS, 60, 10, 300);
const POLL_MS = clampInt(process.env.AETHER_WORKER_POLL_MS, 1000, 250, 30000);
const RECOVERY_MS = clampInt(process.env.AETHER_WORKER_RECOVERY_MS, 10000, 1000, 120000);
const HEARTBEAT_MS = Math.min(Math.max(1000, Math.floor((LEASE_SECONDS * 1000) / 3)), 30000);
let stopping = false;
let activeRunId: string | null = null;
function clampInt(value: string | undefined, fallback: number, min: number, max: number): number { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback; }
function requireRuntimeEnvironment(): void { for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!process.env[key]) throw new Error(`Missing required runtime environment variable: ${key}`); }
async function safeTelemetry(input: Parameters<typeof recordObservabilityEvent>[0]): Promise<void> { try { await recordObservabilityEvent(input); } catch (error) { console.error(`[Aether worker ${WORKER_ID}] observability write failed:`, error); } }
async function recoverExpiredWork(): Promise<void> { const { data, error } = await supabaseAdmin.rpc("requeue_expired_runtime_work", { p_limit: 100 }); if (error) throw new Error(`Runtime recovery failed: ${error.message}`); if (Number(data ?? 0) > 0) await safeTelemetry({ context: createObservabilityContext({ workerId: WORKER_ID }), component: "runtime-worker", eventType: "runtime.recovery", message: `Recovered ${data} expired run(s)`, metadata: { recovered: Number(data) } }); }
async function claimNextRun(): Promise<any | null> { const { data, error } = await supabaseAdmin.rpc("claim_next_runtime_run", { p_worker_id: WORKER_ID, p_lease_seconds: LEASE_SECONDS }); if (error) throw new Error(`Runtime claim failed: ${error.message}`); return Array.isArray(data) && data.length ? data[0] : null; }
async function markWorker(status: "idle" | "running" | "draining" | "offline"): Promise<void> { const now = new Date().toISOString(); const { error } = await supabaseAdmin.from("runtime_workers").upsert({ worker_id: WORKER_ID, status, current_run_id: status === "idle" || status === "offline" ? null : activeRunId, last_heartbeat_at: now, metadata: { runtime: "phase-a", pid: process.pid }, updated_at: now }); if (error) throw new Error(`Worker status update failed: ${error.message}`); }
async function scheduleRetryIfNeeded(taskId: string, runId: string): Promise<void> { const { data: run, error } = await supabaseAdmin.from("task_runs").select("status,retryable,error").eq("id", runId).eq("task_id", taskId).maybeSingle(); if (error) throw new Error(`Failed to inspect runtime failure: ${error.message}`); if (run?.status !== "failed" || run.retryable !== true) return; const { error: retryError } = await supabaseAdmin.rpc("schedule_runtime_retry", { p_task_id: taskId, p_run_id: runId, p_reason: run.error ?? "Runtime execution failed" }); if (retryError) throw new Error(`Failed to schedule runtime retry: ${retryError.message}`); }
async function executeClaim(claim: any): Promise<void> {
  const taskId = String(claim.task_id), runId = String(claim.run_id), ownerId = String(claim.owner_id), taskKind = String(claim.task_kind);
  const detail = claim.task_detail && typeof claim.task_detail === "object" ? claim.task_detail : {};
  const inputs = claim.inputs && typeof claim.inputs === "object" ? claim.inputs : {};
  const topic = typeof detail.topic === "string" ? detail.topic.trim() : typeof inputs.topic === "string" ? inputs.topic.trim() : typeof inputs.query === "string" ? inputs.query.trim() : undefined;
  const urls = Array.isArray(detail.urls ?? inputs.urls) ? (detail.urls ?? inputs.urls).filter((v: unknown): v is string => typeof v === "string").map((v: string) => v.trim()).filter(Boolean).slice(0, 10) : [];
  const traceId = typeof claim.trace_id === "string" && claim.trace_id ? claim.trace_id : runId;
  const context = createObservabilityContext({ traceId, workerId: WORKER_ID, taskId, runId, userId: ownerId });
  const span = await startObservabilitySpan({ context, name: `runtime:${taskKind}`, component: "runtime-worker", attributes: { taskKind, attempt: claim.attempt ?? null } });
  activeRunId = runId; await markWorker("running");
  const heartbeatTimer = setInterval(() => { void heartbeatRuntimeRun(supabaseAdmin, runId, WORKER_ID, LEASE_SECONDS).catch((error: unknown) => { void safeTelemetry({ context, level: "warn", component: "runtime-worker", eventType: "runtime.heartbeat_failed", message: error instanceof Error ? error.message : String(error), errorCode: "heartbeat_failed" }); }); }, HEARTBEAT_MS);
  try {
    if (taskKind === "research") {
      await executeResearchStep(supabaseAdmin, { taskId, runId, ownerId, projectId: claim.project_id ?? null, urls, topic, deadlineAt: claim.deadline_at ?? undefined, workerId: WORKER_ID });
    } else if (taskKind === "knowledge-acquisition") {
      await executeKnowledgeAcquisitionRuntimeStep(supabaseAdmin, { taskId, runId, ownerId, projectId: claim.project_id ?? null, deadlineAt: claim.deadline_at ?? undefined, workerId: WORKER_ID });
    } else {
      throw new Error(`No registered runtime executor for task kind: ${taskKind}`);
    }
    await scheduleRetryIfNeeded(taskId, runId);
    await span.finish("completed");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await safeTelemetry({ context, level: "error", component: "runtime-worker", eventType: "runtime.run_error", message, success: false, retryable: true, errorCode: "worker_execution_error" });
    const { data: current } = await supabaseAdmin.from("task_runs").select("status").eq("id", runId).eq("worker_id", WORKER_ID).maybeSingle();
    if (current?.status === "running") {
      const now = new Date().toISOString();
      await supabaseAdmin.from("task_runs").update({ status: "failed", failure_code: "worker_execution_error", retryable: true, error: message, ended_at: now, worker_id: null, lease_expires_at: null, heartbeat_at: null, updated_at: now }).eq("id", runId).eq("worker_id", WORKER_ID).eq("status", "running");
      await supabaseAdmin.from("tasks").update({ status: "failed", last_error_code: "worker_execution_error", last_error_message: message, completed_at: now, worker_id: null, lease_expires_at: null, heartbeat_at: null, updated_at: now }).eq("id", taskId).eq("worker_id", WORKER_ID).eq("status", "running");
      await supabaseAdmin.rpc("append_task_event", { p_task_id: taskId, p_run_id: runId, p_event_type: "run.failed", p_from_status: "running", p_to_status: "failed", p_message: message, p_data: { failure_code: "worker_execution_error", retryable: true }, p_worker_id: WORKER_ID });
    }
    await scheduleRetryIfNeeded(taskId, runId); await span.finish("failed", "worker_execution_error");
  } finally { clearInterval(heartbeatTimer); activeRunId = null; if (!stopping) await markWorker("idle"); }
}
async function sleep(ms: number): Promise<void> { await new Promise((resolve) => setTimeout(resolve, ms)); }
async function run(): Promise<void> { requireRuntimeEnvironment(); await markWorker("idle"); let nextRecoveryAt = 0; while (!stopping) { try { const now = Date.now(); if (now >= nextRecoveryAt) { await recoverExpiredWork(); nextRecoveryAt = now + RECOVERY_MS; } const claim = await claimNextRun(); if (claim) await executeClaim(claim); else await sleep(POLL_MS); } catch (error: unknown) { console.error(`[Aether worker ${WORKER_ID}] loop error:`, error); await safeTelemetry({ context: createObservabilityContext({ workerId: WORKER_ID }), level: "error", component: "runtime-worker", eventType: "worker.loop_error", message: error instanceof Error ? error.message : String(error), success: false, errorCode: "worker_loop_error" }); await sleep(Math.min(5000, POLL_MS * 2)); } } await markWorker("offline"); }
process.on("SIGTERM", () => { stopping = true; }); process.on("SIGINT", () => { stopping = true; });
if (process.argv.includes("--check")) { requireRuntimeEnvironment(); console.log("Aether runtime worker entrypoint OK"); } else { void run().catch((error) => { console.error(error); process.exitCode = 1; }); }
