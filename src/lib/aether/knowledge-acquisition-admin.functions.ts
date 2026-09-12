import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const db = context.supabase as SupabaseClient;
  const { data, error } = await db.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Response(error.message, { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const adminStartKnowledgeAcquisitionNow = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskId: string }) => ({ taskId: String(d?.taskId ?? "").trim() })).handler(async ({ context, data }) => {
  await requireAdmin(context);
  const { data: task, error } = await supabaseAdmin.from("tasks").select("id,status,kind,priority").eq("id", data.taskId).maybeSingle();
  if (error || !task) throw new Response("Task not found", { status: 404 });
  if (task.kind !== "knowledge-acquisition") throw new Response("Task is not a knowledge acquisition job", { status: 409 });
  if (!["queued", "scheduled", "retrying", "paused"].includes(task.status)) throw new Response("Only queued, scheduled, retrying or paused acquisition can be started", { status: 409 });
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin.from("tasks").update({ status: "queued", priority: 100, next_attempt_at: null, cancel_requested_at: null, updated_at: now }).eq("id", task.id);
  if (updateError) throw new Response(updateError.message, { status: 500 });
  await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({ status: "queued", paused_at: null, updated_at: now, last_event_at: now }).eq("task_id", task.id);
  await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "knowledge_acquisition.start_now", target_type: "task", target_id: task.id, metadata: { priority: 100 } });
  return { ok: true };
});

export const adminCancelKnowledgeAcquisition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskId: string; reason?: string }) => ({ taskId: String(d?.taskId ?? "").trim(), reason: String(d?.reason ?? "Cancelled by administrator").trim().slice(0, 500) || "Cancelled by administrator" })).handler(async ({ context, data }) => {
  await requireAdmin(context);
  const { data: task, error } = await supabaseAdmin.from("tasks").select("id,status,kind").eq("id", data.taskId).maybeSingle();
  if (error || !task || task.kind !== "knowledge-acquisition") throw new Response("Knowledge acquisition task not found", { status: 404 });
  const now = new Date().toISOString();
  if (["queued", "scheduled", "paused", "retrying"].includes(task.status)) {
    const { error: taskError } = await supabaseAdmin.from("tasks").update({ status: "cancelled", cancel_requested_at: now, completed_at: now, updated_at: now }).eq("id", task.id).eq("status", task.status);
    if (taskError) throw new Response(taskError.message, { status: 500 });
    await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({ status: "cancelled", cancel_reason: data.reason, completed_at: now, last_event_at: now, updated_at: now }).eq("task_id", task.id);
  } else if (task.status === "running") {
    const { error: cancelError } = await supabaseAdmin.from("tasks").update({ cancel_requested_at: now, updated_at: now }).eq("id", task.id).eq("status", "running");
    if (cancelError) throw new Response(cancelError.message, { status: 500 });
  } else if (task.status === "waiting_approval") {
    const { error: cancelError } = await supabaseAdmin.from("tasks").update({ status: "cancelled", cancel_requested_at: now, completed_at: now, updated_at: now }).eq("id", task.id).eq("status", "waiting_approval");
    if (cancelError) throw new Response(cancelError.message, { status: 500 });
    await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({ status: "cancelled", cancel_reason: data.reason, last_event_at: now, updated_at: now }).eq("task_id", task.id);
  } else {
    throw new Response(`Cannot cancel acquisition in ${task.status} state`, { status: 409 });
  }
  await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "knowledge_acquisition.cancelled", target_type: "task", target_id: task.id, metadata: { reason: data.reason } });
  return { ok: true };
});
