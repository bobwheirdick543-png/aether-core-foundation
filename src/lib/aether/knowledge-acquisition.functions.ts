import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createKnowledgeAcquisitionTask, normalizeResearchBudget } from "./knowledge-acquisition-runtime";

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const db = context.supabase as SupabaseClient;
  const { data, error } = await db.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Response("Unable to verify administrator authorization", { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const startKnowledgeAcquisition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { subject: string; title?: string; projectId?: string | null; sourceType?: string; targetType?: "agent" | "model" | "models" | "global"; targetModelKeys?: string[]; timeBudgetMs?: number; priority?: number }) => {
  const subject = String(d?.subject ?? "").trim().slice(0, 300);
  if (subject.length < 3) throw new Response("A research subject is required", { status: 400 });
  return { subject, title: d.title?.trim().slice(0, 160), projectId: d.projectId ?? null, sourceType: (d.sourceType ?? "background") as any, targetType: d.targetType ?? "global", targetModelKeys: d.targetModelKeys ?? [], timeBudgetMs: normalizeResearchBudget(d.timeBudgetMs), priority: d.priority ?? 0 };
}).handler(async ({ context, data }) => {
  const result = await createKnowledgeAcquisitionTask(supabaseAdmin, { ownerId: context.userId, ...data, trigger: data.sourceType === "background" ? "background_knowledge_gap" : "manual_acquisition" });
  return result;
});

export const listKnowledgeAcquisitionJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d?: { limit?: number; admin?: boolean }) => ({ limit: Math.min(200, Math.max(1, Math.floor(d?.limit ?? 50))), admin: Boolean(d?.admin) })).handler(async ({ context, data }) => {
  if (data.admin) await requireAdmin(context);
  const db = data.admin ? supabaseAdmin : (context.supabase as SupabaseClient);
  let query = db.from("aether_knowledge_acquisition_jobs").select("id,task_id,run_id,owner_id,project_id,title,subject,scope,depth_tier,time_budget_ms,target_type,target_model_keys,source_type,status,coverage,confidence,source_count,domain_count,related_concepts,unresolved_items,candidate_id,approval_status,report_ids,cancel_reason,started_at,completed_at,paused_at,last_event_at,created_at,updated_at").order("created_at", { ascending: false }).limit(data.limit);
  if (!data.admin) query = query.eq("owner_id", context.userId);
  const { data: rows, error } = await query;
  if (error) throw new Response(`Could not load knowledge acquisition jobs: ${error.message}`, { status: 500 });
  return rows ?? [];
});

export const getKnowledgeAcquisitionActivity = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskId: string }) => ({ taskId: String(d?.taskId ?? "").trim() })).handler(async ({ context, data }) => {
  const { data: task, error: taskError } = await supabaseAdmin.from("tasks").select("id,user_id,title,kind,status,progress,priority,started_at,completed_at,deadline_at,detail,worker_id,updated_at").eq("id", data.taskId).maybeSingle();
  if (taskError || !task) throw new Response("Task not found", { status: 404 });
  const isOwner = task.user_id === context.userId;
  if (!isOwner) await requireAdmin(context);
  const { data: events, error } = await supabaseAdmin.from("task_events").select("id,sequence,event_type,from_status,to_status,message,data,worker_id,created_at").eq("task_id", data.taskId).order("sequence", { ascending: true }).limit(250);
  if (error) throw new Response(`Could not load task activity: ${error.message}`, { status: 500 });
  return { task, events: events ?? [] };
});

export const adminSetKnowledgeAcquisitionPriority = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskId: string; priority: number }) => ({ taskId: String(d.taskId), priority: Math.max(-100, Math.min(100, Math.floor(d.priority))) })).handler(async ({ context, data }) => {
  await requireAdmin(context);
  const { data: task, error } = await supabaseAdmin.from("tasks").select("id,status,kind").eq("id", data.taskId).maybeSingle();
  if (error || !task) throw new Response("Task not found", { status: 404 });
  if (task.kind !== "knowledge-acquisition") throw new Response("Task is not a knowledge acquisition job", { status: 409 });
  if (!["queued","scheduled","paused","retrying"].includes(task.status)) throw new Response("Priority can only be changed before active execution", { status: 409 });
  const { error: updateError } = await supabaseAdmin.from("tasks").update({ priority: data.priority, updated_at: new Date().toISOString() }).eq("id", task.id);
  if (updateError) throw new Response(updateError.message, { status: 500 });
  await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "knowledge_acquisition.priority_changed", target_type: "task", target_id: task.id, metadata: { priority: data.priority } });
  return { ok: true };
});

export const adminPauseKnowledgeAcquisition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskId: string; reason?: string }) => ({ taskId: String(d.taskId), reason: d.reason?.trim().slice(0, 500) || "Paused by administrator" })).handler(async ({ context, data }) => {
  await requireAdmin(context);
  const { data: task } = await supabaseAdmin.from("tasks").select("id,status,kind").eq("id", data.taskId).maybeSingle();
  if (!task || task.kind !== "knowledge-acquisition") throw new Response("Knowledge acquisition task not found", { status: 404 });
  if (task.status !== "queued" && task.status !== "scheduled") throw new Response("Only queued or scheduled acquisition can be paused safely", { status: 409 });
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("tasks").update({ status: "paused", updated_at: now, detail: { pause_reason: data.reason } }).eq("id", task.id).eq("status", task.status);
  if (error) throw new Response(error.message, { status: 500 });
  await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({ status: "paused", paused_at: now, updated_at: now, last_event_at: now }).eq("task_id", task.id);
  await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "knowledge_acquisition.paused", target_type: "task", target_id: task.id, metadata: { reason: data.reason } });
  return { ok: true };
});

export const adminResumeKnowledgeAcquisition = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskId: string }) => ({ taskId: String(d.taskId) })).handler(async ({ context, data }) => {
  await requireAdmin(context);
  const { data: task } = await supabaseAdmin.from("tasks").select("id,status,kind").eq("id", data.taskId).maybeSingle();
  if (!task || task.kind !== "knowledge-acquisition") throw new Response("Knowledge acquisition task not found", { status: 404 });
  if (task.status !== "paused") throw new Response("Only paused acquisition can be resumed", { status: 409 });
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("tasks").update({ status: "queued", updated_at: now }).eq("id", task.id).eq("status", "paused");
  if (error) throw new Response(error.message, { status: 500 });
  await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({ status: "queued", paused_at: null, updated_at: now, last_event_at: now }).eq("task_id", task.id);
  await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "knowledge_acquisition.resumed", target_type: "task", target_id: task.id });
  return { ok: true };
});
