/**
 * AETHER SECURITY & COMPLIANCE FOUNDATION
 *
 * The Security Agent monitors and flags.
 * Backend authorization (RLS + server functions + agentAllows) remains authoritative.
 * No agent can grant itself permissions.
 */

import type { AgentKey } from "./agents";
import { agentAllows } from "./agent-sdk";

export type SecurityEventSeverity = "low" | "medium" | "high" | "critical";

export type SecurityEventType =
  | "permission_violation"
  | "cross_user_access_attempt"
  | "unauthorized_agent_action"
  | "escalation_attempt"
  | "abnormal_task_behavior"
  | "repeated_auth_failure"
  | "suspicious_api_activity"
  | "dangerous_config_change"
  | "boundary_violation";

export interface SecurityEvent {
  id?: string;
  event_type: SecurityEventType;
  severity: SecurityEventSeverity;
  agent_key?: AgentKey | null;
  actor_id?: string | null;
  task_id?: string | null;
  run_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  attempted_action?: string;
  message: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  acknowledged?: boolean;
}

/**
 * Deterministic boundary check.
 * Call before any agent side-effect.
 * Returns a SecurityEvent if the action is forbidden.
 */
export function checkAgentBoundary(
  agentKey: AgentKey,
  permission: string,
  context: {
    actorId?: string;
    taskId?: string;
    runId?: string;
    resourceType?: string;
    resourceId?: string;
  } = {},
): { allowed: true } | { allowed: false; event: SecurityEvent } {
  const check = agentAllows(agentKey, permission);
  if (check.allowed) {
    return { allowed: true };
  }

  const event: SecurityEvent = {
    event_type: "permission_violation",
    severity: "high",
    agent_key: agentKey,
    actor_id: context.actorId ?? null,
    task_id: context.taskId ?? null,
    run_id: context.runId ?? null,
    resource_type: context.resourceType ?? null,
    resource_id: context.resourceId ?? null,
    attempted_action: permission,
    message: `Agent "${agentKey}" attempted "${permission}" which is not permitted${check.reason ? ` (${check.reason})` : ""}.`,
    metadata: { requiresApproval: check.requiresApproval },
    created_at: new Date().toISOString(),
    acknowledged: false,
  };

  return { allowed: false, event };
}

/**
 * Assert boundary or throw.
 * Use in server functions before performing the action.
 */
export function assertAgentBoundary(
  agentKey: AgentKey,
  permission: string,
  context: Parameters<typeof checkAgentBoundary>[2] = {},
): void {
  const result = checkAgentBoundary(agentKey, permission, context);
  if (!result.allowed) {
    // Caller should also persist the event to audit / security tables
    throw new Error(result.event.message);
  }
}
