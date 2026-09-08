/**
 * AETHER TASK SERVICE (server-side)
 *
 * Creates tasks and runs, enforces ownership and state transitions.
 * Designed to be called from createServerFn handlers.
 * Does not execute agents — only manages the durable work records.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertTransition,
  type TaskStatus,
  type CreateTaskInput,
  type CreateRunInput,
  makeIdempotencyKey,
} from "./task-runtime";

export async function createTask(
  admin: SupabaseClient,
  input: CreateTaskInput,
): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("tasks")
    .insert({
      owner_id: input.owner_id,
      project_id: input.project_id ?? null,
      title: input.title,
      kind: input.kind,
      status: input.status ?? "queued",
      progress: 0,
      detail: input.detail ?? {},
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create task");
  return { id: data.id };
}

export async function createRun(
  admin: SupabaseClient,
  input: CreateRunInput,
): Promise<{ id: string }> {
  const attempt = input.attempt ?? 1;
  const idempotency =
    input.idempotency_key ??
    makeIdempotencyKey("run", input.task_id, `attempt-${attempt}`);

  // Idempotent insert — if key exists, return existing
  const { data: existing } = await admin
    .from("task_runs")
    .select("id")
    .eq("idempotency_key", idempotency)
    .maybeSingle();

  if (existing) return { id: existing.id };

  const row: Record<string, unknown> = {
    task_id: input.task_id,
    owner_id: input.owner_id,
    agent_id: input.agent_id ?? null,
    attempt,
    status: "queued",
    inputs: input.inputs ?? {},
    outputs: {},
    retry_of: input.retry_of ?? null,
    idempotency_key: idempotency,
  };

  // agent_key is optional depending on migration state
  if (input.agent_key) {
    row.agent_key = input.agent_key;
  }

  const { data, error } = await admin
    .from("task_runs")
    .insert(row)
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create run");
  return { id: data.id };
}

export async function transitionTaskStatus(
  admin: SupabaseClient,
  taskId: string,
  from: TaskStatus,
  to: TaskStatus,
  extra?: { progress?: number; detail?: Record<string, unknown> },
): Promise<void> {
  assertTransition(from, to);

  const patch: Record<string, unknown> = {
    status: to,
    updated_at: new Date().toISOString(),
  };
  if (extra?.progress !== undefined) patch.progress = extra.progress;
  if (extra?.detail) patch.detail = extra.detail;
  if (to === "running") patch.started_at = new Date().toISOString();
  if (to === "completed" || to === "failed" || to === "cancelled") {
    patch.completed_at = new Date().toISOString();
  }

  const { error } = await admin.from("tasks").update(patch).eq("id", taskId).eq("status", from);
  if (error) throw new Error(error.message);
}

export async function transitionRunStatus(
  admin: SupabaseClient,
  runId: string,
  from: TaskStatus,
  to: TaskStatus,
  extra?: { outputs?: Record<string, unknown>; error?: string },
): Promise<void> {
  assertTransition(from, to);

  const patch: Record<string, unknown> = {
    status: to,
    updated_at: new Date().toISOString(),
  };
  if (to === "running") patch.started_at = new Date().toISOString();
  if (to === "completed" || to === "failed" || to === "cancelled") {
    patch.ended_at = new Date().toISOString();
  }
  if (extra?.outputs) patch.outputs = extra.outputs;
  if (extra?.error) patch.error = extra.error;

  const { error } = await admin.from("task_runs").update(patch).eq("id", runId).eq("status", from);
  if (error) throw new Error(error.message);
}

export async function getTaskWithRuns(
  admin: SupabaseClient,
  taskId: string,
  ownerId: string,
  isAdmin: boolean,
) {
  let q = admin.from("tasks").select("*").eq("id", taskId);
  if (!isAdmin) q = q.eq("owner_id", ownerId);
  const { data: task, error } = await q.single();
  if (error || !task) throw new Error("Task not found or access denied");

  const { data: runs } = await admin
    .from("task_runs")
    .select("*")
    .eq("task_id", taskId)
    .order("attempt", { ascending: true });

  return { task, runs: runs ?? [] };
}
