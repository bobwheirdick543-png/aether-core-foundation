/**
 * AETHER AGENT SDK
 *
 * Strongly-typed contracts for internal platform workers.
 * Authorization is enforced by the backend (RLS + server functions),
 * never by agent instructions alone.
 *
 * Agents are internal workers, not user-facing chatbots.
 */

import { AGENTS, type AgentKey, type AgentDefinition as BaseAgentDefinition } from "@/lib/aether/agents";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_approval"
  | "paused"
  | "retrying"
  | "scheduled";

export type VerificationState =
  | "verified"
  | "needs_review"
  | "conflicting"
  | "unsupported"
  | "outdated"
  | "rejected"
  | "pending";

/** Timeout / retry / escalation policy */
export interface AgentPolicy {
  timeoutMs: number;
  maxRetries: number;
  backoffMs?: number;
  escalateOnFailure: boolean;
  escalateTo?: "admin" | "security" | "orchestrator";
}

/** Schedule configuration */
export interface AgentScheduleConfig {
  enabled: boolean;
  type?: "one_time" | "delayed" | "recurring" | "interval" | "date_range" | "event";
  cron?: string;
  intervalMinutes?: number;
  startAt?: string;
  endAt?: string;
}

/** Telemetry configuration */
export interface AgentTelemetryConfig {
  collectMetrics: boolean;
  collectTimeline: boolean;
  retainDays: number;
}

/** Extended agent definition used by the runtime */
export interface FullAgentDefinition extends BaseAgentDefinition {
  agent_id: string;
  version: string;
  allowed_inputs: string[];
  expected_outputs: string[];
  quality_requirements: string[];
  timeout_policy: AgentPolicy;
  retry_policy: AgentPolicy;
  escalation_policy: AgentPolicy;
  schedule_configuration: AgentScheduleConfig;
  telemetry_configuration: AgentTelemetryConfig;
}

/** Structured input every agent task must receive */
export interface AgentTaskContext {
  taskId: string;
  runId: string;
  agentKey: AgentKey;
  agentId?: string;
  requesterId: string;
  projectId?: string | null;
  taskType: string;
  priority?: number | "low" | "normal" | "high" | "critical";
  deadline?: string | null;
  permissionsContext?: string[];
  inputs: Record<string, unknown>;
  previousResults?: AgentResult[];
  sourceContext?: Record<string, unknown>;
}

export interface AgentArtifactRef {
  type: string;
  id?: string;
  path?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

/** Structured output every agent must return */
export interface AgentResult {
  taskId: string;
  runId: string;
  agentKey: AgentKey;
  agentId?: string;
  status: AgentRunStatus;
  result?: Record<string, unknown>;
  artifacts?: AgentArtifactRef[];
  findings?: Array<{
    claim: string;
    evidence?: string;
    confidence?: number;
    sources?: string[];
    verification_state?: VerificationState;
    [key: string]: unknown;
  }>;
  warnings?: string[];
  errors?: string[];
  confidence?: number | null;
  nextAction?: string | null;
  requiresReview?: boolean;
  timestamp: string;
  metrics?: Record<string, number | string>;
}

/** Inter-agent structured message */
export interface AgentMessage {
  fromAgent: AgentKey;
  toAgent: AgentKey;
  runId: string;
  taskId: string;
  type: string;
  payload: AgentResult | Record<string, unknown>;
  timestamp: string;
}

export function getAgentContract(key: AgentKey) {
  return AGENTS.find((a) => a.key === key) ?? null;
}

/** Deterministic permission check from agent contract. Not the only security layer. */
export function agentAllows(
  key: AgentKey,
  permission: string,
): {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
} {
  const agent = getAgentContract(key);
  if (!agent) return { allowed: false, requiresApproval: false, reason: "Unknown agent" };
  if (agent.status === "disabled" || agent.status === "maintenance") {
    return { allowed: false, requiresApproval: false, reason: `Agent is ${agent.status}` };
  }
  const perm = agent.permissions.find((p) => p.permission === permission);
  if (!perm) return { allowed: false, requiresApproval: false, reason: "Permission not granted" };
  return {
    allowed: perm.allowed,
    requiresApproval: Boolean(perm.requiresApproval),
  };
}

export function assertAgentPermission(key: AgentKey, permission: string): void {
  const check = agentAllows(key, permission);
  if (!check.allowed) {
    throw new Error(
      `Permission denied for ${key}: ${permission}${check.reason ? ` (${check.reason})` : ""}`,
    );
  }
}

/** Create a full agent definition with sensible defaults */
export function createFullAgentDefinition(
  base: BaseAgentDefinition,
  overrides?: Partial<FullAgentDefinition>,
): FullAgentDefinition {
  const defaultPolicy: AgentPolicy = {
    timeoutMs: 300_000,
    maxRetries: 2,
    backoffMs: 5_000,
    escalateOnFailure: true,
    escalateTo: "admin",
  };

  return {
    ...base,
    agent_id: overrides?.agent_id ?? `agent_${base.key}`,
    version: overrides?.version ?? "1.0.0",
    allowed_inputs: overrides?.allowed_inputs ?? ["task_context", "previous_results"],
    expected_outputs: overrides?.expected_outputs ?? ["result", "status", "requires_review"],
    quality_requirements: overrides?.quality_requirements ?? [
      "structured output",
      "source traceability where applicable",
      "no silent production writes",
    ],
    timeout_policy: overrides?.timeout_policy ?? defaultPolicy,
    retry_policy: overrides?.retry_policy ?? { ...defaultPolicy, maxRetries: 3 },
    escalation_policy: overrides?.escalation_policy ?? defaultPolicy,
    schedule_configuration: overrides?.schedule_configuration ?? { enabled: false },
    telemetry_configuration: overrides?.telemetry_configuration ?? {
      collectMetrics: true,
      collectTimeline: true,
      retainDays: 90,
    },
    ...overrides,
  };
}
