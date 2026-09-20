import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createKnowledgeAcquisitionTask, normalizeResearchBudget } from "./knowledge-acquisition-runtime";

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const db = context.supabase as SupabaseClient;
  const { data, error } = await db.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error) throw new Response(error.message, { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const adminStartKnowledgeAcquisitionNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => ({ taskId: String(d?.taskId ?? "").trim() }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { data: task, error } = await supabaseAdmin.from("tasks").select("id,status,kind,priority,detail,deadline_at").eq("id", data.taskId).maybeSingle();
    if (error || !task) throw new Response("Task not found", { status: 404 });
    if (task.kind !== "knowledge-acquisition") throw new Response("Task is not a knowledge acquisition job", { status: 409 });
    if (!["queued", "scheduled", "retrying", "paused"].includes(task.status)) throw new Response("Only queued, scheduled, retrying or paused acquisition can be started", { status: 409 });
    const now = new Date();
    const detail = task.detail && typeof task.detail === "object" ? task.detail as Record<string, unknown> : {};
    const remaining = Number(detail.remaining_budget_ms);
    const patch: Record<string, unknown> = { status: "queued", priority: 100, next_attempt_at: null, cancel_requested_at: null, cancellation_reason: null, updated_at: now.toISOString(), detail: { ...detail, pause_requested: false } };
    if (task.status === "paused") {
      if (!Number.isFinite(remaining) || remaining <= 0) throw new Response("The paused acquisition has no remaining research budget; create a new mission instead", { status: 409 });
      const deadline = new Date(now.getTime() + remaining).toISOString();
      patch.deadline_at = deadline;
      patch.detail = { ...detail, pause_requested: false, resumed_at: now.toISOString(), remaining_budget_ms: remaining };
      const { data: job } = await supabaseAdmin.from("aether_knowledge_acquisition_jobs").select("run_id").eq("task_id", task.id).maybeSingle();
      if (job?.run_id) await supabaseAdmin.from("task_runs").update({ status: "queued", cancel_requested_at: null, cancellation_reason: null, ended_at: null, deadline_at: deadline, updated_at: now.toISOString() }).eq("id", job.run_id).eq("status", "paused");
    }
    const { error: updateError } = await supabaseAdmin.from("tasks").update(patch).eq("id", task.id).eq("status", task.status);
    if (updateError) throw new Response(updateError.message, { status: 500 });
    await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({ status: "queued", paused_at: null, updated_at: now.toISOString(), last_event_at: now.toISOString() }).eq("task_id", task.id);
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "knowledge_acquisition.start_now", target_type: "task", target_id: task.id, metadata: { priority: 100, resumed_from_pause: task.status === "paused", remaining_budget_ms: task.status === "paused" ? remaining : null } });
    return { ok: true };
  });

export const adminCancelKnowledgeAcquisition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string; reason?: string }) => ({
    taskId: String(d?.taskId ?? "").trim(),
    reason:
      String(d?.reason ?? "Cancelled by administrator").trim().slice(0, 500) ||
      "Cancelled by administrator",
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .select("id,status,kind")
      .eq("id", data.taskId)
      .maybeSingle();
    if (error || !task || task.kind !== "knowledge-acquisition")
      throw new Response("Knowledge acquisition task not found", { status: 404 });
    const now = new Date().toISOString();
    if (["queued", "scheduled", "paused", "retrying"].includes(task.status)) {
      const { error: taskError } = await supabaseAdmin
        .from("tasks")
        .update({
          status: "cancelled",
          cancel_requested_at: now,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", task.id)
        .eq("status", task.status);
      if (taskError) throw new Response(taskError.message, { status: 500 });
      await supabaseAdmin
        .from("aether_knowledge_acquisition_jobs")
        .update({
          status: "cancelled",
          cancel_reason: data.reason,
          completed_at: now,
          last_event_at: now,
          updated_at: now,
        })
        .eq("task_id", task.id);
    } else if (task.status === "running") {
      const { error: cancelError } = await supabaseAdmin
        .from("tasks")
        .update({ cancel_requested_at: now, updated_at: now })
        .eq("id", task.id)
        .eq("status", "running");
      if (cancelError) throw new Response(cancelError.message, { status: 500 });
    } else if (task.status === "waiting_approval") {
      const { error: cancelError } = await supabaseAdmin
        .from("tasks")
        .update({
          status: "cancelled",
          cancel_requested_at: now,
          completed_at: now,
          updated_at: now,
        })
        .eq("id", task.id)
        .eq("status", "waiting_approval");
      if (cancelError) throw new Response(cancelError.message, { status: 500 });
      await supabaseAdmin
        .from("aether_knowledge_acquisition_jobs")
        .update({
          status: "cancelled",
          cancel_reason: data.reason,
          last_event_at: now,
          updated_at: now,
        })
        .eq("task_id", task.id);
    } else {
      throw new Response(`Cannot cancel acquisition in ${task.status} state`, { status: 409 });
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "knowledge_acquisition.cancelled",
      target_type: "task",
      target_id: task.id,
      metadata: { reason: data.reason },
    });
    return { ok: true };
  });

/**
 * Enqueue a new knowledge acquisition mission from a workstation prompt.
 * Optional deadlineISO stops the work window so the admin can approve results.
 */
export const adminEnqueueKnowledgeAcquisitionFromPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { prompt: string; subject?: string; deadlineISO?: string | null }) => ({
    prompt: String(d?.prompt ?? "").trim().slice(0, 12000),
    subject: String(d?.subject ?? "").trim().slice(0, 200),
    deadlineISO: d?.deadlineISO ? String(d.deadlineISO) : null,
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    if (!data.prompt) throw new Response("Prompt is required", { status: 400 });
    const nowMs = Date.now();
    const subject = data.subject || data.prompt.slice(0, 80);
    let timeBudgetMs: number | undefined;
    if (data.deadlineISO) {
      const requestedDeadline = new Date(data.deadlineISO).getTime();
      if (!Number.isFinite(requestedDeadline) || requestedDeadline <= nowMs) throw new Response("The research deadline must be a valid future time", { status: 400 });
      timeBudgetMs = normalizeResearchBudget(requestedDeadline - nowMs);
    }
    const result = await createKnowledgeAcquisitionTask(supabaseAdmin, { ownerId: context.userId, subject, title: `Acquisition: ${subject}`, sourceType: "prompt", targetType: "global", timeBudgetMs, priority: 50, trigger: "admin_workstation_prompt" });
    const now = new Date().toISOString();
    const { data: job, error: jobError } = await supabaseAdmin.from("aether_knowledge_acquisition_jobs").select("scope,task_id").eq("id", result.jobId).single();
    if (jobError || !job) throw new Response(jobError?.message ?? "Could not load acquisition job", { status: 500 });
    const { data: task, error: taskError } = await supabaseAdmin.from("tasks").select("detail,deadline_at").eq("id", result.taskId).single();
    if (taskError || !task) throw new Response(taskError?.message ?? "Could not load acquisition task", { status: 500 });
    const effectiveDeadline = task.deadline_at;
    const detail = task.detail && typeof task.detail === "object" ? task.detail as Record<string, unknown> : {};
    await supabaseAdmin.from("tasks").update({ detail: { ...detail, source: "workstation_prompt", prompt: data.prompt, subject, deadline: effectiveDeadline, submitted_by: context.userId, submitted_at: now }, updated_at: now }).eq("id", result.taskId);
    const scope = job.scope && typeof job.scope === "object" ? job.scope as Record<string, unknown> : {};
    await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({ scope: { ...scope, prompt: data.prompt, deadline: effectiveDeadline, submitted_by: context.userId, submitted_at: now }, updated_at: now, last_event_at: now }).eq("id", result.jobId);
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "knowledge_acquisition.enqueued_from_prompt", target_type: "task", target_id: result.taskId, metadata: { job_id: result.jobId, subject, has_deadline: Boolean(data.deadlineISO), deduplicated: result.deduplicated } });
    return { ok: true, taskId: result.taskId, runId: result.runId, jobId: result.jobId, deduplicated: result.deduplicated };
  });
