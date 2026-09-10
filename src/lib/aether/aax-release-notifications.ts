import type { SupabaseClient } from "@supabase/supabase-js";

async function sendReleaseEmail(admin: SupabaseClient, userId: string, title: string, body: string, notificationId: string) {
  if (!process.env.AETHER_EMAIL_API_KEY || !process.env.AETHER_EMAIL_FROM || (process.env.AETHER_EMAIL_PROVIDER ?? "resend") !== "resend") return { sent: false, reason: "email provider not configured" };
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return { sent: false, reason: "user email unavailable" };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.AETHER_EMAIL_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.AETHER_EMAIL_FROM, to: [data.user.email], subject: title, text: body }) });
  if (!response.ok) return { sent: false, reason: `email provider returned ${response.status}` };
  await admin.from("notification_deliveries").insert({ notification_id: notificationId, channel: "email", destination: data.user.email, status: "sent", attempts: 1, sent_at: new Date().toISOString() });
  return { sent: true };
}

export async function announceAaxRelease(admin: SupabaseClient, modelId: string, title: string, body: string) {
  const { data: users, error: usersError } = await admin.from("profiles").select("id");
  if (usersError) throw new Error(usersError.message);
  if (!users?.length) return { created: 0, emailed: 0 };
  const rows = users.map((user) => ({ recipient_id: user.id, audience: "user", event_type: "aax.release", title, body, resource_type: "aax_model", resource_id: modelId, link: "/models", status: "pending" }));
  const { data: notifications, error } = await admin.from("notifications").insert(rows).select("id,recipient_id");
  if (error) throw new Error(error.message);
  const now = new Date().toISOString();
  const deliveries = (notifications ?? []).flatMap((notification) => [{ notification_id: notification.id, channel: "in_app", status: "sent", attempts: 1, sent_at: now }, { notification_id: notification.id, channel: "web", status: "sent", attempts: 1, sent_at: now }]);
  if (deliveries.length) { const { error: deliveryError } = await admin.from("notification_deliveries").insert(deliveries); if (deliveryError) throw new Error(deliveryError.message); }
  let emailed = 0;
  for (const notification of notifications ?? []) { const result = await sendReleaseEmail(admin, notification.recipient_id, title, body, notification.id); if (result.sent) emailed += 1; }
  return { created: rows.length, emailed };
}
