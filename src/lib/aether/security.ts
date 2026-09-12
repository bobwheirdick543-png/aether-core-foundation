/**
 * AETHER SECURITY & COMPLIANCE FOUNDATION
 *
 * This module is the agent-specific compatibility boundary. Backend
 * authorization, ownership/RLS and server-side policy remain authoritative.
 * No agent can grant itself permissions or escalate its own privileges.
 */
import type { AgentKey } from "./agents";
import { agentAllows } from "./agent-sdk";
import { recordObservabilityEvent } from "./observability";

export type SecurityEventSeverity = "low" | "medium" | "high" | "critical";
export type SecurityEventType =
  | "permission_violation" | "cross_user_access_attempt" | "unauthorized_agent_action"
  | "escalation_attempt" | "abnormal_task_behavior" | "repeated_auth_failure"
  | "suspicious_api_activity" | "dangerous_config_change" | "boundary_violation";

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

export function checkAgentBoundary(
  agentKey: AgentKey,
  permission: string,
  context: { actorId?: string; taskId?: string; runId?: string; resourceType?: string; resourceId?: string } = {},
): { allowed: true } | { allowed: false; event: SecurityEvent } {
  const check = agentAllows(agentKey, permission);
  if (check.allowed) return { allowed: true };

  return { allowed: false, event: {
    event_type: check.reason === "Permission not granted" ? "permission_violation" : "unauthorized_agent_action",
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
  }};
}

export function assertAgentBoundary(
  agentKey: AgentKey,
  permission: string,
  context: Parameters<typeof checkAgentBoundary>[2] = {},
): void {
  const result = checkAgentBoundary(agentKey, permission, context);
  if (result.allowed) return;
  throw new Error(result.event.message);
}

/** Persist a security denial through the Phase W global observability boundary. */
export async function recordSecurityEvent(event: SecurityEvent): Promise<void> {
  await recordObservabilityEvent({
    context: { traceId: crypto.randomUUID(), taskId: event.task_id ?? null, runId: event.run_id ?? null, agentKey: event.agent_key ?? null, userId: event.actor_id ?? null },
    level: event.severity === "critical" || event.severity === "high" ? "error" : event.severity === "medium" ? "warn" : "info",
    component: "security",
    eventType: `security.${event.event_type}`,
    message: event.message,
    success: false,
    retryable: false,
    metadata: { resource_type: event.resource_type ?? null, resource_id: event.resource_id ?? null, attempted_action: event.attempted_action ?? null, ...(event.metadata ?? {}) },
  });
}
