/**
 * AETHER APPROVAL WORKFLOW
 *
 * Default policy: ADMINISTRATOR REVIEW REQUIRED for high-impact results.
 * Supports APPROVE | REJECT | REQUEST_RETRY | EDIT_REVIEW.
 * Never overwrites previous runs — creates new versioned execution.
 */

export type ApprovalDecision = "approve" | "reject" | "request_retry" | "edit_review";

export type ApprovalTargetType =
  | "research_run"
  | "knowledge_entry"
  | "report"
  | "task_run"
  | "agent_config"
  | "optimization_recommendation";

export interface ApprovalRequest {
  id?: string;
  target_type: ApprovalTargetType;
  target_id: string;
  run_id?: string | null;
  task_id?: string | null;
  owner_id: string;
  requested_by: string; // agent or user
  title: string;
  summary?: string;
  evidence?: Record<string, unknown>;
  confidence?: number | null;
  risk_level: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "retried" | "expired";
  created_at?: string;
  decided_at?: string | null;
  decided_by?: string | null;
  decision?: ApprovalDecision | null;
  decision_reason?: string | null;
  new_run_id?: string | null; // set when REQUEST_RETRY creates a new run
}

export interface ApprovalDecisionInput {
  approval_id: string;
  decision: ApprovalDecision;
  reason?: string;
  actor_id: string;
  is_admin: boolean;
}

/**
 * Pure validation of an approval decision.
 * Callers must still perform the actual DB writes and authorization checks.
 */
export function validateApprovalDecision(
  request: ApprovalRequest,
  input: ApprovalDecisionInput,
): { ok: true } | { ok: false; message: string } {
  if (!input.is_admin) {
    return { ok: false, message: "Only administrators may decide high-impact approvals." };
  }
  if (request.status !== "pending") {
    return { ok: false, message: `Approval is already ${request.status}.` };
  }
  if (input.decision === "request_retry" && !input.reason?.trim()) {
    // reason is optional but recommended; we allow empty for now
  }
  return { ok: true };
}

/** Create the payload for a new retry run linked to a previous run */
export function buildRetryPayload(
  previousRunId: string,
  reason: string | undefined,
  actorId: string,
): {
  retry_of: string;
  retry_reason: string;
  created_by: string;
  timestamp: string;
} {
  return {
    retry_of: previousRunId,
    retry_reason: reason?.trim() || "Administrator requested retry",
    created_by: actorId,
    timestamp: new Date().toISOString(),
  };
}
