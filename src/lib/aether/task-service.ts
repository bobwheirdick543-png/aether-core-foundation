/**
 * AETHER UNIVERSAL TASK SERVICE (server-side)
 *
 * Durable task/run persistence. This layer never trusts browser state and never
 * overwrites an earlier attempt. Domain execution belongs to workers/agents.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertTransition,
  deadlineFromTimeout,
  exponentialBackoffMs,
  resolveTimeoutMs,
  type CreateRunInput,
  type CreateTaskInput,
  type TaskEvent,
  type TaskStatus,
} from "./task-runtime";

export async function appendTaskEvent(admin: SupabaseClient, input: {
  taskId: string; runId?: string | null; eventType: string; fromStatus?: TaskStatus | null;
  toStatus?: TaskStatus | null; message?: string; data?: Record<string, unknown>;
  actorId?: string | null; workerId?: string | null;
}): Promise<TaskEvent> {
  const { data, error } = await admin.rpc("append_task_event", {
    p_task_id: input.taskId, p_run_id: input.runId ?? null, p_event_type: input.eventType,
    p_from_status: input.fromStatus ?? null, p_to_status: input.toStatus ?? null,
    p_message: input.message ?? null, p_data: input.data ?? {},
    p_actor_id: input.actorId ?? null, p_worker_id: input.workerId ?? null,
  });
  if (error || !data) throw new Error(error?.message || "Failed to append task event");
  return data as TaskEvent;
}

export async function createTask(admin: SupabaseClient, input: CreateTaskInput): Promise<{ id: string }> {
  const timeoutMs = resolveTimeoutMs(input.timeout_ms);
  const maxRetries = Math.max(0, Math.min(20, Math.floor(input.max_retries ?? 3)));
  const deadline = input.deadline_at ?? deadlineFromTimeout(timeoutMs);
  if (input.idempotency_key) {
    const { data: existing } = await admin.from("tasks").select("id").eq("idempotency_key", input.idempotency_key).maybeSingle();
    if (existing) return { id: existing.id };
  }
  const { data, error } = await admin.from("tasks").insert({
    user_id: input.owner_id, project_id: input.project_id ?? null, title: input.title,
    kind: input.kind, status: input.status ?? "queued", progress: 0,
    priority: Math.max(-100, Math.min(100, Math.floor(input.priority ?? 0))),
    detail: input.detail ?? {}, timeout_ms: timeoutMs, deadline_at: deadline,
    max_retries: maxRetries, next_attempt_at: null, idempotency_key: input.idempotency_key ?? null,
  }).select("id").single();
  if (error || !data) {
    if (input.idempotency_key) {
      const { data: existing } = await admin.from("tasks").select("id").eq("idempotency_key", input.idempotency_key).maybeSingle();
      if (existing) return { id: existing.id };
    }
    throw new Error(error?.message || "Failed to create task");
  }
  await appendTaskEvent(admin, { taskId: data.id, eventType: "task.created", toStatus: input.status ?? "queued",
    message: "Task accepted by the universal runtime", data: { kind: input.kind, timeout_ms: timeoutMs, max_retries: maxRetries }, actorId: input.owner_id });
  return { id: data.id };
}

export async function createRun(admin: SupabaseClient, input: CreateRunInput): Promise<{ id: string }> {
  const attempt = Math.max(1, Math.floor(input.attempt ?? 1));
  const timeoutMs = resolveTimeoutMs(input.timeout_ms);
  const idempotency = input.idempotency_key ?? `aether:run:${input.task_id}:attempt-${attempt}`;
  const { data: existing } = await admin.from("task_runs").select("id").eq("idempotency_key", idempotency).maybeSingle();
  if (existing) return { id: existing.id };
  const { data, error } = await admin.from("task_runs").insert({
    task_id: input.task_id, owner_id: input.owner_id, agent_id: input.agent_id ?? null,
    agent_key: input.agent_key ?? null, attempt, status: "queued", inputs: input.inputs ?? {}, outputs: {},
    retry_of: input.retry_of ?? null, idempotency_key: idempotency, timeout_ms: timeoutMs,
    deadline_at: input.deadline_at ?? deadlineFromTimeout(timeoutMs),
    max_retries: Math.max(0, Math.min(20, Math.floor(input.max_retries ?? 3))), retry_count: 0,
  }).select("id").single();
  if (error || !data) {
    const { data: raced } = await admin.from("task_runs").select("id").eq("idempotency_key", idempotency).maybeSingle();
    if (raced) return { id: raced.id };
    throw new Error(error?.message || "Failed to create run");
  }
  await appendTaskEvent(admin, { taskId: input.task_id, runId: data.id, eventType: "run.created", toStatus: "queued",
    message: `Execution attempt ${attempt} created`, data: { attempt, retry_of: input.retry_of ?? null }, actorId: input.owner_id });
  return { id: data.id };
}

export async function transitionTaskStatus(admin: SupabaseClient, taskId: string, from: TaskStatus, to: TaskStatus,
  extra?: { progress?: number; detail?: Record<string, unknown>; actorId?: string; workerId?: string }): Promise<void> {
  assertTransition(from, to);
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to, updated_at: now };
  if (extra?.progress !== undefined) patch.progress = Math.max(0, Math.min(100, Math.floor(extra.progress)));
  if (extra?.detail) patch.detail = extra.detail;
  if (to === "running") patch.started_at = now;
  if (to === "completed" || to === "failed" || to === "cancelled") patch.completed_at = now;
  if (to !== "running") { patch.worker_id = null; patch.lease_expires_at = null; patch.heartbeat_at = null; }
  const { data, error } = await admin.from("tasks").update(patch).eq("id", taskId).eq("status", from).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Task state changed concurrently; expected ${from}`);
  await appendTaskEvent(admin, { taskId, eventType: "task.status_changed", fromStatus: from, toStatus: to,
    message: `Task transitioned ${from} → ${to}`, data: { progress: extra?.progress }, actorId: extra?.actorId, workerId: extra?.workerId });
}

export async function transitionRunStatus(admin: SupabaseClient, runId: string, from: TaskStatus, to: TaskStatus,
  extra?: { outputs?: Record<string, unknown>; error?: string; failureCode?: string; retryable?: boolean; actorId?: string; workerId?: string }): Promise<void> {
  assertTransition(from, to);
  const now = new Date().toISOString();
  const { data: current, error: loadError } = await admin.from("task_runs").select("id, task_id, started_at").eq("id", runId).single();
  if (loadError || !current) throw new Error(loadError?.message || "Run not found");
  const patch: Record<string, unknown> = { status: to, updated_at: now };
  if (to === "running") patch.started_at = current.started_at ?? now;
  if (to === "completed" || to === "failed" || to === "cancelled") {
    patch.ended_at = now; if (current.started_at) patch.duration_ms = Math.max(0, Date.now() - new Date(current.started_at).getTime());
    patch.worker_id = null; patch.lease_expires_at = null; patch.heartbeat_at = null;
  }
  if (extra?.outputs) patch.outputs = extra.outputs;
  if (extra?.error !== undefined) patch.error = extra.error;
  if (extra?.failureCode !== undefined) patch.failure_code = extra.failureCode;
  if (extra?.retryable !== undefined) patch.retryable = extra.retryable;
  const { data, error } = await admin.from("task_runs").update(patch).eq("id", runId).eq("status", from).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Run state changed concurrently; expected ${from}`);
  await appendTaskEvent(admin, { taskId: current.task_id, runId, eventType: "run.status_changed", fromStatus: from, toStatus: to,
    message: `Run transitioned ${from} → ${to}`, data: { failure_code: extra?.failureCode ?? null }, actorId: extra?.actorId, workerId: extra?.workerId });
}

export async function scheduleRunRetry(admin: SupabaseClient, taskId: string, runId: string, reason: string, failureCode: string, retryCount: number): Promise<void> {
  const delayMs = exponentialBackoffMs(retryCount);
  const nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
  const patch = { status: "retrying", retry_count: retryCount + 1, next_attempt_at: nextAttemptAt, worker_id: null,
    lease_expires_at: null, heartbeat_at: null, failure_code: failureCode, retryable: true, error: reason, updated_at: new Date().toISOString() };
  const { error: runError } = await admin.from("task_runs").update(patch).eq("id", runId);
  if (runError) throw new Error(runError.message);
  const { error: taskError } = await admin.from("tasks").update({ status: "retrying", retry_count: retryCount + 1,
    next_attempt_at: nextAttemptAt, worker_id: null, lease_expires_at: null, heartbeat_at: null,
    last_error_code: failureCode, last_error_message: reason, updated_at: new Date().toISOString() }).eq("id", taskId);
  if (taskError) throw new Error(taskError.message);
  await appendTaskEvent(admin, { taskId, runId, eventType: "run.retry_scheduled", fromStatus: "running", toStatus: "retrying",
    message: reason, data: { failure_code: failureCode, delay_ms: delayMs, retry_count: retryCount + 1 } });
}

export async function heartbeatRuntimeRun(admin: SupabaseClient, runId: string, workerId: string, leaseSeconds = 60): Promise<void> {
  const now = new Date(); const lease = new Date(now.getTime() + Math.max(10, leaseSeconds) * 1000).toISOString();
  const { data: run, error } = await admin.from("task_runs").select("id, task_id").eq("id", runId).eq("worker_id", workerId).eq("status", "running").maybeSingle();
  if (error) throw new Error(error.message); if (!run) throw new Error("Runtime lease is no longer owned by this worker");
  const { error: runError } = await admin.from("task_runs").update({ heartbeat_at: now.toISOString(), lease_expires_at: lease, updated_at: now.toISOString() }).eq("id", runId).eq("worker_id", workerId);
  if (runError) throw new Error(runError.message);
  const { error: taskError } = await admin.from("tasks").update({ heartbeat_at: now.toISOString(), lease_expires_at: lease, updated_at: now.toISOString() }).eq("id", run.task_id).eq("worker_id", workerId);
  if (taskError) throw new Error(taskError.message);
  await admin.from("runtime_workers").update({ last_heartbeat_at: now.toISOString(), updated_at: now.toISOString() }).eq("worker_id", workerId);
}

export async function getTaskWithRuns(admin: SupabaseClient, taskId: string, ownerId: string, isAdmin: boolean) {
  let q = admin.from("tasks").select("*").eq("id", taskId);
  if (!isAdmin) q = q.eq("user_id", ownerId);
  const { data: task, error } = await q.single(); if (error || !task) throw new Error("Task not found or access denied");
  const { data: runs, error: runsError } = await admin.from("task_runs").select("*").eq("task_id", taskId).order("attempt", { ascending: true });
  if (runsError) throw new Error(runsError.message); return { task, runs: runs ?? [] };
}

export async function getTaskEvents(admin: SupabaseClient, taskId: string, ownerId: string, isAdmin: boolean) {
  const { data: task, error } = await admin.from("tasks").select("user_id").eq("id", taskId).single();
  if (error || !task || (!isAdmin && task.user_id !== ownerId)) throw new Error("Task not found or access denied");
  const { data, error: eventsError } = await admin.from("task_events").select("*").eq("task_id", taskId).order("sequence", { ascending: true });
  if (eventsError) throw new Error(eventsError.message); return data ?? [];
}
