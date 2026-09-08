/**
 * AETHER NOTIFICATION OWNERSHIP & DELIVERY CONTRACT
 *
 * Critical rule: NEVER deliver a resource belonging to user A to user B.
 * Every notification carries explicit recipient + resource context.
 * Backend must re-verify ownership before delivery and before any action link is followed.
 */

export type NotificationAudience = "user" | "admin";
export type NotificationStatus = "pending" | "delivered" | "failed" | "read";

export type NotificationEventType =
  | "task.completed"
  | "task.failed"
  | "task.waiting_approval"
  | "report.ready"
  | "research.completed"
  | "knowledge.review_required"
  | "agent.failed"
  | "security.alert"
  | "optimization.recommendation"
  | "system.alert"
  | "approval.required"
  | "retry.requested";

export interface NotificationPayload {
  recipient_id: string;
  audience: NotificationAudience;
  event_type: NotificationEventType;
  title: string;
  body?: string;
  resource_type?: string;
  resource_id?: string;
  task_id?: string;
  run_id?: string;
  report_id?: string;
  link?: string; // relative path inside Aether, never external unauthenticated
  metadata?: Record<string, unknown>;
}

export interface DeliveryResult {
  ok: boolean;
  notification_id?: string;
  status: NotificationStatus;
  error?: string;
  delivered_at?: string;
}

/**
 * Pre-delivery validation.
 * Call this before inserting a notification or sending email.
 */
export function validateNotificationOwnership(
  payload: NotificationPayload,
  resourceOwnerId: string | null | undefined,
  isAdminRecipient: boolean,
): { ok: true } | { ok: false; message: string } {
  if (!payload.recipient_id) {
    return { ok: false, message: "recipient_id is required" };
  }

  // Admin-audience notifications may go to any admin
  if (payload.audience === "admin") {
    if (!isAdminRecipient) {
      return { ok: false, message: "Admin-audience notification requires an administrator recipient" };
    }
    return { ok: true };
  }

  // User-audience: recipient must own the resource (or be explicitly authorized)
  if (resourceOwnerId && resourceOwnerId !== payload.recipient_id) {
    return {
      ok: false,
      message: "Cross-user notification blocked: recipient does not own the referenced resource",
    };
  }

  return { ok: true };
}

/** Build a safe relative link for the notification */
export function buildNotificationLink(
  event: NotificationEventType,
  ids: { taskId?: string; runId?: string; reportId?: string; resourceId?: string },
  isAdmin: boolean,
): string {
  const base = isAdmin ? "/admin" : "";
  switch (event) {
    case "task.completed":
    case "task.failed":
    case "task.waiting_approval":
      return ids.taskId ? `${base}/tasks` : `${base}/dashboard`;
    case "report.ready":
      return ids.reportId ? `${base}/reports` : `${base}/dashboard`;
    case "research.completed":
      return `${base}/research`;
    case "knowledge.review_required":
    case "approval.required":
      return isAdmin ? "/admin/knowledge" : "/knowledge";
    case "agent.failed":
    case "security.alert":
    case "optimization.recommendation":
    case "system.alert":
      return isAdmin ? "/admin/team" : "/dashboard";
    default:
      return isAdmin ? "/admin" : "/dashboard";
  }
}
