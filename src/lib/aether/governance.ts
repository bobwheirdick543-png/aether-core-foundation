/**
 * AETHER GOVERNANCE
 *
 * Deterministic rules for what requires administrator approval.
 * Complements agent permissions and RLS.
 */

export type ImpactLevel = "low" | "medium" | "high" | "critical";

export interface GovernanceRule {
  key: string;
  description: string;
  impact: ImpactLevel;
  requiresApproval: boolean;
  requiresAdmin: boolean;
}

export const GOVERNANCE_RULES: GovernanceRule[] = [
  {
    key: "knowledge.production_publish",
    description: "Publishing knowledge to production",
    impact: "high",
    requiresApproval: true,
    requiresAdmin: true,
  },
  {
    key: "report.high_impact_approve",
    description: "Approving a high-impact report",
    impact: "high",
    requiresApproval: true,
    requiresAdmin: true,
  },
  {
    key: "agent.config_activate",
    description: "Activating a new agent configuration version",
    impact: "high",
    requiresApproval: true,
    requiresAdmin: true,
  },
  {
    key: "agent.permission_change",
    description: "Changing agent permission boundaries",
    impact: "critical",
    requiresApproval: true,
    requiresAdmin: true,
  },
  {
    key: "user.role_change",
    description: "Changing a user role",
    impact: "critical",
    requiresApproval: true,
    requiresAdmin: true,
  },
  {
    key: "system.config_change",
    description: "Changing system configuration",
    impact: "critical",
    requiresApproval: true,
    requiresAdmin: true,
  },
  {
    key: "optimization.apply",
    description: "Applying an optimization recommendation",
    impact: "medium",
    requiresApproval: true,
    requiresAdmin: true,
  },
  {
    key: "research.sandbox_write",
    description: "Writing to research sandbox",
    impact: "low",
    requiresApproval: false,
    requiresAdmin: false,
  },
];

export function getRule(key: string): GovernanceRule | undefined {
  return GOVERNANCE_RULES.find((r) => r.key === key);
}

export function requiresApproval(key: string): boolean {
  return getRule(key)?.requiresApproval ?? true; // fail closed
}

export function requiresAdmin(key: string): boolean {
  return getRule(key)?.requiresAdmin ?? true;
}

/** Standard audit action names used across the platform */
export const AUDIT_ACTIONS = {
  ADMIN_BOOTSTRAP: "admin.bootstrap.completed",
  ADMIN_LOGIN: "admin.session.started",
  ADMIN_CREDENTIALS_CHANGED: "admin.credentials.changed_via_setup_code",
  TASK_CREATED: "task.created",
  TASK_TRANSITION: "task.status_changed",
  RESEARCH_COMPLETED: "research.completed",
  KNOWLEDGE_APPROVED: "knowledge.approved",
  KNOWLEDGE_REJECTED: "knowledge.rejected",
  REPORT_REGISTERED: "report.registered",
  NOTIFICATION_CREATED: "notification.created",
  PERMISSION_VIOLATION: "security.permission_violation",
  OPTIMIZATION_RECOMMENDED: "optimization.recommended",
  AGENT_CONFIG_CHANGED: "agent.config_changed",
} as const;
