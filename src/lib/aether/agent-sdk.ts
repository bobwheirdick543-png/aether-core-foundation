/**
 * Aether Agent SDK — shared contracts for internal platform workers.
 * Authorization is enforced by the backend, not by agent instructions.
 */

import { AGENTS, type AgentKey } from "@/lib/aether/agents";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_approval";

export interface AgentTaskContext {
  taskId: string;
  runId: string;
  agentKey: AgentKey;
  requesterId: string;
  projectId?: string | null;
  taskType: string;
  priority?: number;
  deadline?: string | null;
  inputs: Record<string, unknown>;
  previousResults?: Record<string, unknown>;
}

export interface AgentArtifactRef {
  type: string;
  id?: string;
  path?: string;
  title?: string;
}

export interface AgentResult {
  taskId: string;
  runId: string;
  agentKey: AgentKey;
  status: AgentRunStatus;
  result?: Record<string, unknown>;
  artifacts?: AgentArtifactRef[];
  findings?: Array<Record<string, unknown>>;
  warnings?: string[];
  errors?: string[];
  confidence?: number | null;
  nextAction?: string | null;
  requiresReview?: boolean;
  timestamp: string;
  metrics?: Record<string, number | string>;
}

export function getAgentContract(key: AgentKey) {
  return AGENTS.find((a) => a.key === key) ?? null;
}

/** Deterministic permission check from agent contract. Not the only security layer. */
export function agentAllows(key: AgentKey, permission: string): {
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
    throw new Error(`Permission denied for ${key}: ${permission}${check.reason ? ` (${check.reason})` : ""}`);
  }
}
