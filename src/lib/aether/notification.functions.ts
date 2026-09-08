/**
 * AETHER NOTIFICATION SERVER FUNCTIONS
 * Creates notifications only after ownership validation.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  validateNotificationOwnership,
  buildNotificationLink,
  type NotificationPayload,
  type NotificationEventType,
  type NotificationAudience,
} from "./notifications";

export const createNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    recipientId: string;
    audience?: NotificationAudience;
    eventType: NotificationEventType;
    title: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
    taskId?: string;
    runId?: string;
    reportId?: string;
    resourceOwnerId?: string;
  }) => {
    if (!data?.recipientId) throw new Error("recipientId required");
    if (!data?.eventType) throw new Error("eventType required");
    if (!data?.title?.trim()) throw new Error("title required");
    return {
      recipientId: String(data.recipientId),
      audience: (data.audience || "user") as NotificationAudience,
      eventType: data.eventType,
      title: data.title.trim().slice(0, 200),
      body: data.body?.trim().slice(0, 1000) || null,
      resourceType: data.resourceType || null,
      resourceId: data.resourceId || null,
      taskId: data.taskId || null,
      runId: data.runId || null,
      reportId: data.reportId || null,
      resourceOwnerId: data.resourceOwnerId || null,
    };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Determine if recipient is admin (for audience checks)
    const { data: recipientIsAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: data.recipientId,
      _role: "admin",
    });

    const payload: NotificationPayload = {
      recipient_id: data.recipientId,
      audience: data.audience,
      event_type: data.eventType,
      title: data.title,
      body: data.body || undefined,
      resource_type: data.resourceType || undefined,
      resource_id: data.resourceId || undefined,
      task_id: data.taskId || undefined,
      run_id: data.runId || undefined,
      report_id: data.reportId || undefined,
    };

    const validation = validateNotificationOwnership(
      payload,
      data.resourceOwnerId,
      Boolean(recipientIsAdmin),
    );

    if (!validation.ok) {
      throw new Error(validation.message);
    }

    const link = buildNotificationLink(
      data.eventType,
      {
        taskId: data.taskId || undefined,
        runId: data.runId || undefined,
        reportId: data.reportId || undefined,
        resourceId: data.resourceId || undefined,
      },
      Boolean(recipientIsAdmin),
    );

    const { data: row, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        recipient_id: data.recipientId,
        audience: data.audience,
        event_type: data.eventType,
        title: data.title,
        body: data.body,
        resource_type: data.resourceType,
        resource_id: data.resourceId,
        link,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !row) throw new Error(error?.message || "Failed to create notification");

    return { notificationId: row.id, link };
  });

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, event_type, title, body, link, status, created_at, read_at, resource_type, resource_id")
      .eq("recipient_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
