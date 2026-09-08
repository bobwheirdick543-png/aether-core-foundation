/**
 * AETHER TASK / RUN RUNTIME FOUNDATION
 *
 * Separates TASK (requested/scheduled unit of work) from RUN (one execution attempt).
 * Background-capable. Browser-independent.
 * Explicit ownership. Idempotent side-effects. Strict state transitions.
 *
 * No fabricated activity. No silent success.
 */

import type { AgentKey } from "./agents";
import type { AgentResult, AgentTaskContext } from "./agent-sdk";

export type TaskStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused"
  | "retrying"
  | "scheduled";

export type RunStatus = TaskStatus;

/** Allowed transitions — invalid ones must be rejected */
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ["running", "cancelled", "scheduled"],
  scheduled: ["queued", "cancelled"],
  running: ["completed", "failed", "waiting_approval", "cancelled", "paused", "retrying"],
  waiting_approval: ["completed", "failed", "retrying", "cancelled"],
  paused: ["running", "cancelled", "queued"],
  retrying: ["running", "failed", "cancelled"],
  completed: [], // terminal
  failed: ["retrying", "cancelled"], // can be retried
  cancelled: [], // terminal
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid task/run state transition: ${from} → ${to}`);
  }
}

/** Core Task record shape (maps to public.tasks) */
export interface TaskRecord {
  id: string;
  owner_id: string;
  project_id?: string | null;
  title: string;
  kind: string; // research | knowledge | report | etc.
  status: TaskStatus;
  progress: number;
  detail: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Core Run record shape (maps to public.task_runs) */
export interface RunRecord {
  id: string;
  task_id: string;
  owner_id: string;
  agent_id?: string | null;
  agent_key?: AgentKey | null;
  attempt: number;
  status: RunStatus;
  started_at?: string | null;
  ended_at?: string | null;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: string | null;
  retry_of?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
}

/** Create a new task payload (server-side only) */
export interface CreateTaskInput {
  owner_id: string;
  project_id?: string | null;
  title: string;
  kind: string;
  detail?: Record<string, unknown>;
  status?: TaskStatus;
}

/** Create a new run for an existing task */
export interface CreateRunInput {
  task_id: string;
  owner_id: string;
  agent_id?: string | null;
  agent_key?: AgentKey | null;
  attempt?: number;
  inputs?: Record<string, unknown>;
  retry_of?: string | null;
  idempotency_key?: string | null;
}

/** Result of a state transition */
export interface TransitionResult {
  ok: boolean;
  previous: TaskStatus;
  next: TaskStatus;
  message?: string;
}

/**
 * Pure helper: compute the next status after an agent finishes.
 * Does not write to the database — callers must persist.
 */
export function deriveStatusFromAgentResult(result: AgentResult): TaskStatus {
  if (result.status === "waiting_approval" || result.requiresReview) {
    return "waiting_approval";
  }
  if (result.status === "failed" || (result.errors && result.errors.length > 0)) {
    return "failed";
  }
  if (result.status === "cancelled") return "cancelled";
  if (result.status === "completed") return "completed";
  return result.status as TaskStatus;
}

/**
 * Build a minimal AgentTaskContext from task + run records.
 * Used by the orchestrator / agents.
 */
export function buildAgentContext(
  task: TaskRecord,
  run: RunRecord,
  agentKey: AgentKey,
): AgentTaskContext {
  return {
    taskId: task.id,
    runId: run.id,
    agentKey,
    agentId: run.agent_id ?? undefined,
    requesterId: task.owner_id,
    projectId: task.project_id,
    taskType: task.kind,
    priority: "normal",
    inputs: run.inputs ?? {},
    previousResults: [],
  };
}

/**
 * Idempotency helper — generate a stable key for a side-effect operation.
 * Callers should store and check this before performing notification, PDF write, etc.
 */
export function makeIdempotencyKey(
  kind: string,
  taskId: string,
  runId: string,
  extra?: string,
): string {
  return `aether:${kind}:${taskId}:${runId}${extra ? `:${extra}` : ""}`;
}

/** Ownership check — never infer from browser state */
export function assertOwnership(
  resourceOwnerId: string,
  actorId: string,
  isAdmin: boolean,
): void {
  if (resourceOwnerId !== actorId && !isAdmin) {
    throw new Error("Forbidden: resource does not belong to the current actor");
  }
}
