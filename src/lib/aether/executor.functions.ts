/**
 * Server entry point for the controlled agent executor.
 * Ownership is verified. No external AI.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { executeResearchStep } from "./executor";
import { isHttpUrl } from "./research-engine";

export const advanceResearchRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { taskId: string; runId: string; urls?: string[]; topic?: string }) => {
    if (!data?.taskId || !data?.runId) throw new Error("taskId and runId are required");
    const urls = (data.urls ?? []).filter((u) => typeof u === "string" && isHttpUrl(u)).slice(0, 10);
    return {
      taskId: String(data.taskId),
      runId: String(data.runId),
      urls,
      topic: data.topic?.trim().slice(0, 300) || undefined,
    };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ownership check
    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("id, owner_id, status")
      .eq("id", data.taskId)
      .single();

    if (!task) throw new Error("Task not found");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    if (task.owner_id !== context.userId && !isAdmin) {
      throw new Error("Forbidden");
    }

    const result = await executeResearchStep(supabaseAdmin, {
      taskId: data.taskId,
      runId: data.runId,
      ownerId: task.owner_id,
      urls: data.urls,
      topic: data.topic,
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "run.advanced",
      target_type: "task_runs",
      target_id: data.runId,
      metadata: {
        agent: "research",
        status: result.status,
        source_count: (result.result as any)?.source_count ?? 0,
      },
    });

    return result;
  });
