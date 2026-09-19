import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createRun, appendTaskEvent } from "./task-service";

async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Response(error.message, { status: 500 });
  return Boolean(data);
}

async function loadAccess(context: { userId: string }, jobId: string) {
  const admin = await isAdmin(context.userId);
  const { data: job, error } = await supabaseAdmin
    .from("aether_knowledge_acquisition_jobs")
    .select("*,task_id,run_id,owner_id")
    .eq("id", jobId)
    .maybeSingle();
  if (error || !job) throw new Response("Acquisition mission not found", { status: 404 });
  if (!admin && job.owner_id !== context.userId) throw new Response("Forbidden", { status: 403 });
  return { job, admin };
}

export const getKnowledgeAcquisitionConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => ({ jobId: String(d?.jobId ?? "").trim() }))
  .handler(async ({ context, data }) => {
    const { job } = await loadAccess(context, data.jobId);
    const { data: messages, error } = await supabaseAdmin
      .from("aether_knowledge_acquisition_messages")
      .select("id,job_id,task_id,owner_id,sender_type,sender_id,content,action_type,metadata,created_at")
      .eq("job_id", job.id)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Response(error.message, { status: 500 });
    return { job, messages: messages ?? [] };
  });

export const sendKnowledgeAcquisitionMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string; message: string; action?: string; minutes?: number; aspectId?: string }) => ({
    jobId: String(d?.jobId ?? "").trim(),
    message: String(d?.message ?? "").trim().slice(0, 12000),
    action: String(d?.action ?? "message").trim(),
    minutes: Math.min(60, Math.max(1, Math.floor(Number(d?.minutes ?? 5)))),
    aspectId: d?.aspectId ? String(d.aspectId).trim().slice(0, 120) : null,
  }))
  .handler(async ({ context, data }) => {
    if (!data.message) throw new Response("Message is required", { status: 400 });
    const { job, admin } = await loadAccess(context, data.jobId);
    const normalized = data.message.toLowerCase();
    const inferredExtend = /(?:give|add|extend).{0,30}(?:more\s+)?time|more\s+minutes?|five\s+more\s+minutes?/.test(normalized);
    const inferredContinue = /continue|keep researching|research (?:the|this) aspect|dig deeper|go deeper/.test(normalized);
    const actionType = data.action === "extend_time" || inferredExtend
      ? "extend_time"
      : data.action === "continue_aspect" || inferredContinue
        ? "continue_aspect"
        : data.action === "refine_research"
          ? "refine_research"
          : "message";

    const { data: inserted, error: messageError } = await supabaseAdmin
      .from("aether_knowledge_acquisition_messages")
      .insert({
        job_id: job.id,
        task_id: job.task_id,
        owner_id: job.owner_id,
        sender_type: "user",
        sender_id: context.userId,
        content: data.message,
        action_type: actionType,
        metadata: { requested_minutes: data.minutes, aspect_id: data.aspectId, is_admin: admin },
      })
      .select("id,created_at")
      .single();
    if (messageError || !inserted) throw new Response(messageError?.message ?? "Could not persist message", { status: 500 });

    if (actionType === "extend_time") {
      const minutes = data.minutes;
      const now = Date.now();
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("id,status,deadline_at,detail")
        .eq("id", job.task_id)
        .maybeSingle();
      if (!task) throw new Response("Acquisition task not found", { status: 404 });
      if (!["queued", "running", "paused", "waiting_approval"].includes(task.status)) {
        throw new Response(`Cannot extend a mission in ${task.status} state`, { status: 409 });
      }

      const currentBudget = Number(job.time_budget_ms ?? 0);
      const extensionMs = minutes * 60_000;
      const nextBudget = Math.min(60 * 60_000, currentBudget + extensionMs);
      if (nextBudget <= currentBudget) throw new Response("The maximum research budget has already been reached", { status: 409 });

      const previousDeadline = task.deadline_at ? new Date(task.deadline_at).getTime() : now;
      const newDeadlineMs = Math.max(now, Number.isFinite(previousDeadline) ? previousDeadline : now) + extensionMs;
      const newDeadline = new Date(newDeadlineMs).toISOString();
      const patch: Record<string, unknown> = {
        deadline_at: newDeadline,
        timeout_ms: nextBudget,
        updated_at: new Date().toISOString(),
      };

      const detail = task.detail && typeof task.detail === "object" ? task.detail as Record<string, unknown> : {};
      patch.detail = {
        ...detail,
        time_extensions: [...(Array.isArray(detail.time_extensions) ? detail.time_extensions : []), {
          minutes,
          at: new Date().toISOString(),
          actor_id: context.userId,
        }].slice(-50),
      };

      if (task.status === "waiting_approval") {
        const previousRunId = job.run_id as string | null;
        const { data: previousRuns } = await supabaseAdmin
          .from("task_runs")
          .select("attempt,inputs,agent_key,timeout_ms,max_retries")
          .eq("task_id", task.id)
          .order("attempt", { ascending: false })
          .limit(1);
        const previous = previousRuns?.[0];
        const continuationInput = {
          ...(previous?.inputs ?? {}),
          continuation_reason: data.message,
          continuation_aspect_id: data.aspectId ?? null,
          requested_by: context.userId,
        };
        const nextRun = await createRun(supabaseAdmin, {
          task_id: task.id,
          owner_id: job.owner_id,
          agent_key: previous?.agent_key ?? "knowledge-acquisition",
          inputs: continuationInput,
          attempt: Number(previous?.attempt ?? 0) + 1,
          retry_of: previousRunId,
          timeout_ms: nextBudget,
          max_retries: previous?.max_retries ?? 3,
          deadline_at: newDeadline,
          idempotency_key: `ka:${job.id}:continuation:${Date.now()}`,
        });
        patch.status = "queued";
        patch.progress = Number(task.progress ?? 0);
        patch.completed_at = null;
        patch.execution_ended_at = null;
        await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({
          status: "queued",
          run_id: nextRun.id,
          time_budget_ms: nextBudget,
          approval_status: "pending",
          completed_at: null,
          last_event_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        await appendTaskEvent(supabaseAdmin, { taskId: task.id, runId: nextRun.id, eventType: "knowledge_acquisition.more_time_granted", fromStatus: "waiting_approval", toStatus: "queued", message: `Granted ${minutes} more minute(s) and created continuation execution`, data: { minutes, new_deadline: newDeadline, continuation_aspect_id: data.aspectId ?? null, previous_run_id: previousRunId }, actorId: context.userId });
        patch.detail = { ...(patch.detail as Record<string, unknown>), continuation_aspect_id: data.aspectId ?? null, continuation_message: data.message };
      } else {
        await supabaseAdmin.from("aether_knowledge_acquisition_jobs").update({
          time_budget_ms: nextBudget,
          last_event_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        if (job.run_id) {
          await supabaseAdmin.from("task_runs").update({ deadline_at: newDeadline, timeout_ms: nextBudget, updated_at: new Date().toISOString() }).eq("id", job.run_id).in("status", ["queued", "running", "paused"]);
        }
        await appendTaskEvent(supabaseAdmin, { taskId: task.id, runId: job.run_id, eventType: "knowledge_acquisition.more_time_granted", fromStatus: task.status, toStatus: task.status, message: `Granted ${minutes} more minute(s)`, data: { minutes, new_deadline: newDeadline }, actorId: context.userId });
      }

      const { error: taskError } = await supabaseAdmin.from("tasks").update(patch).eq("id", task.id);
      if (taskError) throw new Response(taskError.message, { status: 500 });
      const { error: extError } = await supabaseAdmin.from("aether_knowledge_acquisition_extensions").insert({
        job_id: job.id,
        task_id: task.id,
        run_id: job.run_id,
        owner_id: job.owner_id,
        actor_id: context.userId,
        minutes,
        previous_deadline: task.deadline_at,
        new_deadline: newDeadline,
        reason: data.message,
      });
      if (extError) throw new Response(extError.message, { status: 500 });
    } else if (actionType === "continue_aspect" || actionType === "refine_research") {
      const { error } = await supabaseAdmin.from("tasks").update({
        detail: {
          ...(job.scope && typeof job.scope === "object" ? job.scope as Record<string, unknown> : {}),
          continuation_aspect_id: data.aspectId ?? null,
          continuation_request: data.message,
          continuation_requested_at: new Date().toISOString(),
          continuation_requested_by: context.userId,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", job.task_id);
      if (error) throw new Response(error.message, { status: 500 });
      await appendTaskEvent(supabaseAdmin, { taskId: job.task_id, runId: job.run_id, eventType: "knowledge_acquisition.research_refined", message: "Research instruction persisted from approval conversation", data: { action_type: actionType, aspect_id: data.aspectId ?? null, message: data.message }, actorId: context.userId });
    }

    return { ok: true, messageId: inserted.id, actionType };
  });

