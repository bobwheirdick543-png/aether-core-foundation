/**
 * AETHER UNIVERSAL TASK RUNTIME
 *
 * Task = durable unit of work. Run = one execution attempt.
 * Attempts are never overwritten. Runtime state is persisted in Supabase so
 * browser lifetime is irrelevant. Domain agents consume this runtime rather
 * than implementing their own queues, retries, cancellation or timeouts.
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

export const TIMEOUT_PRESETS_MS = {
  "20m": 20 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "40m": 40 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "3h": 3 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "5h": 5 * 60 * 60 * 1000,
} as const;

export type TimeoutPreset = keyof typeof TIMEOUT_PRESETS_MS;
export const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_TIMEOUT_MS = TIMEOUT_PRESETS_MS["5h"];

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  queued: ["running", "cancelled", "scheduled", "paused"],
  scheduled: ["queued", "cancelled", "paused"],
  running: ["completed", "failed", "waiting_approval", "cancelled", "paused", "retrying"],
  waiting_approval: ["completed", "failed", "retrying", "cancelled", "paused"],
  paused: ["running", "cancelled", "queued"],
  retrying: ["running", "failed", "cancelled", "paused"],
  completed: ["retrying"],
  failed: ["retrying", "cancelled"],
  cancelled: ["retrying"],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid task/run state transition: ${from} → ${to}`);
  }
}

export function resolveTimeoutMs(value?: number | TimeoutPreset | null): number {
  if (typeof value === "string") return TIMEOUT_PRESETS_MS[value];
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  if (value <= 0) throw new Error("Timeout must be greater than zero");
  return Math.min(Math.floor(value), MAX_TIMEOUT_MS);
}

export function deadlineFromTimeout(timeoutMs: number, now = Date.now()): string {
  return new Date(now + resolveTimeoutMs(timeoutMs)).toISOString();
}

export interface TaskRecord {
  id: string;
  owner_id: string;
  project_id?: string | null;
  title: string;
  kind: string;
  status: TaskStatus;
  progress: number;
  priority: number;
  timeout_ms: number;
  deadline_at?: string | null;
  cancel_requested_at?: string | null;
  cancellation_reason?: string | null;
  worker_id?: string | null;
  lease_expires_at?: string | null;
  heartbeat_at?: string | null;
  retry_count: number;
  max_retries: number;
  next_attempt_at?: string | null;
  detail: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunRecord {
  id: string;
  task_id: string;
  owner_id: string;
  agent_id?: string | null;
  agent_key?: AgentKey | null;
  attempt: number;
  status: RunStatus;
  timeout_ms: number;
  deadline_at?: string | null;
  worker_id?: string | null;
  lease_expires_at?: string | null;
  heartbeat_at?: string | null;
  retry_count: number;
  max_retries: number;
  next_attempt_at?: string | null;
  failure_code?: string | null;
  retryable?: boolean | null;
  duration_ms?: number | null;
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

export interface CreateTaskInput {
  owner_id: string;
  project_id?: string | null;
  title: string;
  kind: string;
  detail?: Record<string, unknown>;
  status?: TaskStatus;
  priority?: number;
  timeout_ms?: number | TimeoutPreset;
  max_retries?: number;
  deadline_at?: string | null;
  idempotency_key?: string | null;
}

export interface CreateRunInput {
  task_id: string;
  owner_id: string;
  agent_id?: string | null;
  agent_key?: AgentKey | null;
  attempt?: number;
  inputs?: Record<string, unknown>;
  retry_of?: string | null;
  idempotency_key?: string | null;
  timeout_ms?: number | TimeoutPreset;
  max_retries?: number;
  deadline_at?: string | null;
}

export interface TransitionResult {
  ok: boolean;
  previous: TaskStatus;
  next: TaskStatus;
  message?: string;
}

export interface TaskEvent {
  id: string;
  task_id: string;
  run_id?: string | null;
  sequence: number;
  event_type: string;
  from_status?: TaskStatus | null;
  to_status?: TaskStatus | null;
  message?: string | null;
  data: Record<string, unknown>;
  actor_id?: string | null;
  worker_id?: string | null;
  created_at: string;
}

export function deriveStatusFromAgentResult(result: AgentResult): TaskStatus {
  if (result.status === "waiting_approval" || result.requiresReview) return "waiting_approval";
  if (result.status === "failed" || (result.errors && result.errors.length > 0)) return "failed";
  if (result.status === "cancelled") return "cancelled";
  if (result.status === "completed") return "completed";
  return result.status as TaskStatus;
}

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
    priority: task.priority ?? "normal",
    deadline: run.deadline_at ?? task.deadline_at ?? null,
    inputs: run.inputs ?? {},
    previousResults: [],
  };
}

export function makeIdempotencyKey(kind: string, taskId: string, runId: string, extra?: string): string {
  return `aether:${kind}:${taskId}:${runId}${extra ? `:${extra}` : ""}`;
}

export function assertOwnership(resourceOwnerId: string, actorId: string, isAdmin: boolean): void {
  if (resourceOwnerId !== actorId && !isAdmin) {
    throw new Error("Forbidden: resource does not belong to the current actor");
  }
}

export function isDeadlineExceeded(deadline?: string | null, now = Date.now()): boolean {
  return Boolean(deadline && new Date(deadline).getTime() <= now);
}

export function exponentialBackoffMs(retryCount: number, baseMs = 5000, capMs = 300000): number {
  const safeCount = Math.max(0, Math.floor(retryCount));
  return Math.min(capMs, baseMs * 2 ** Math.min(safeCount, 10));
}

export function isRetryableFailure(code?: string | null): boolean {
  if (!code) return true;
  return !new Set([
    "cancelled",
    "permission_denied",
    "invalid_input",
    "not_found",
    "policy_denied",
    "approval_rejected",
    "timeout_budget_exhausted",
  ]).has(code);
}
