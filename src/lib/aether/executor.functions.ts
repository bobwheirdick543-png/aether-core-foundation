/**
 * Authenticated entry point for an interactive research execution.
 * It uses the same durable lease/state model as background workers.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeResearchStep } from "./executor";
import { isHttpUrl } from "./research-engine";
import { appendTaskEvent } from "./task-service";

export const advanceResearchRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string; runId: string; urls?: string[]; topic?: string }) => {
    if (!data?.taskId || !data?.runId) throw new Error("taskId and runId are required");
    const urls = (data.urls ?? []).filter((u) => typeof u === "string" && isHttpUrl(u)).slice(0, 10);
    return { taskId: String(data.taskId), runId: String(data.runId), urls, topic: data.topic?.trim().slice(0, 300) || undefined };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task } = await supabaseAdmin.from("tasks").select("id, user_id, status, worker_id, lease_expires_at, deadline_at, started_at").eq("id", data.taskId).single();
    if (!task) throw new Error("Task not found");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (task.user_id !== context.userId && !isAdmin) throw new Error("Forbidden");

    const workerId = `interactive:${context.userId}`;
    if (!["queued", "retrying", "running"].includes(task.status)) throw new Error(`Task is not executable in status "${task.status}"`);
    const { data: run } = await supabaseAdmin.from("task_runs").select("id, status, owner_id, timeout_ms, deadline_at").eq("id", data.runId).eq("task_id", data.taskId).single();
    if (!run || run.owner_id !== task.user_id) throw new Error("Run not found");

    if (["queued", "retrying"].includes(run.status)) {
      const now = new Date();
      const lease = new Date(now.getTime() + 60_000).toISOString();
      const { data: claimedRun, error: runError } = await supabaseAdmin.from("task_runs").update({ status: "running", worker_id: workerId, lease_expires_at: lease, heartbeat_at: now.toISOString(), started_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", run.id).eq("status", run.status).select("id").maybeSingle();
      if (runError) throw new Error(runError.message);
      if (!claimedRun) throw new Error("Run was claimed by another worker");
      const { data: claimedTask, error: taskError } = await supabaseAdmin.from("tasks").update({ status: "running", worker_id: workerId, lease_expires_at: lease, heartbeat_at: now.toISOString(), started_at: task.started_at ?? now.toISOString(), updated_at: now.toISOString() }).eq("id", task.id).in("status", ["queued", "retrying"]).select("id").maybeSingle();
      if (taskError) throw new Error(taskError.message);
      if (!claimedTask) {
        await supabaseAdmin.from("task_runs").update({ status: run.status, worker_id: null, lease_expires_at: null, heartbeat_at: null, updated_at: new Date().toISOString() }).eq("id", run.id).eq("worker_id", workerId);
        throw new Error("Task was claimed by another worker");
      }
      await appendTaskEvent(supabaseAdmin, { taskId: task.id, runId: run.id, eventType: "run.interactive_claimed", fromStatus: run.status, toStatus: "running", message: "Interactive runtime execution claimed", workerId, actorId: context.userId });
    }

    const result = await executeResearchStep(supabaseAdmin, { taskId: data.taskId, runId: data.runId, ownerId: task.user_id, urls: data.urls, topic: data.topic, deadlineAt: run.deadline_at ?? task.deadline_at ?? undefined, workerId });
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "run.advanced", target_type: "task_runs", target_id: data.runId, metadata: { agent: "research", status: result.status, source_count: (result.result as any)?.source_count ?? 0 } });
    return result;
  });
