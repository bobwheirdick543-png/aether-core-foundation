/**
 * AETHER POST-COMPLETION HOOKS
 *
 * Called after a real run finishes. Creates ownership-validated notifications.
 * Never notifies the wrong user.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateNotificationOwnership,
  buildNotificationLink,
  type NotificationEventType,
} from "./notifications";

export async function notifyTaskCompleted(
  admin: SupabaseClient,
  opts: {
    ownerId: string;
    taskId: string;
    runId?: string;
    reportId?: string;
    title: string;
    body?: string;
    eventType?: NotificationEventType;
  },
): Promise<{ notificationId?: string }> {
  const eventType = opts.eventType ?? "task.completed";

  const payload = {
    recipient_id: opts.ownerId,
    audience: "user" as const,
    event_type: eventType,
    title: opts.title,
    body: opts.body,
    task_id: opts.taskId,
    run_id: opts.runId,
    report_id: opts.reportId,
  };

  const validation = validateNotificationOwnership(payload, opts.ownerId, false);
  if (!validation.ok) {
    return {};
  }

  const link = buildNotificationLink(eventType, {
    taskId: opts.taskId,
    runId: opts.runId,
    reportId: opts.reportId,
  }, false);

  const { data, error } = await admin
    .from("notifications")
    .insert({
      recipient_id: opts.ownerId,
      audience: "user",
      event_type: eventType,
      title: opts.title,
      body: opts.body ?? null,
      resource_type: "task",
      resource_id: opts.taskId,
      link,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return {};
  return { notificationId: data.id };
}

export async function notifyAdminAlert(
  admin: SupabaseClient,
  opts: {
    adminUserId: string;
    title: string;
    body?: string;
    eventType?: NotificationEventType;
    taskId?: string;
    runId?: string;
  },
): Promise<{ notificationId?: string }> {
  const eventType = opts.eventType ?? "system.alert";

  const link = buildNotificationLink(eventType, {
    taskId: opts.taskId,
    runId: opts.runId,
  }, true);

  const { data, error } = await admin
    .from("notifications")
    .insert({
      recipient_id: opts.adminUserId,
      audience: "admin",
      event_type: eventType,
      title: opts.title,
      body: opts.body ?? null,
      resource_type: opts.taskId ? "task" : null,
      resource_id: opts.taskId ?? null,
      link,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return {};
  return { notificationId: data.id };
}
