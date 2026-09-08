/**
 * AETHER RESEARCH SERVER FUNCTIONS
 * Uses the native research engine via the controlled executor.
 * No external AI. No fabricated findings.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isHttpUrl } from "./research-engine";
import { createTask, createRun } from "./task-service";
import { executeResearchStep } from "./executor";

export const startResearchRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { topic: string; urls?: string[]; projectId?: string }) => {
    const topic = String(data?.topic ?? "").trim();
    if (!topic) throw new Error("Topic is required");
    const urls = (data?.urls ?? []).filter((u) => typeof u === "string" && isHttpUrl(u)).slice(0, 10);
    return {
      topic: topic.slice(0, 300),
      urls,
      projectId: data?.projectId || null,
    };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const task = await createTask(supabaseAdmin, {
      owner_id: context.userId,
      project_id: data.projectId,
      title: `Research: ${data.topic}`,
      kind: "research",
      detail: { topic: data.topic, urls: data.urls },
      status: "queued",
    });

    const run = await createRun(supabaseAdmin, {
      task_id: task.id,
      owner_id: context.userId,
      agent_key: "research",
      inputs: { topic: data.topic, urls: data.urls },
      attempt: 1,
    });

    // Execute through the controlled, permission-checked path
    const result = await executeResearchStep(supabaseAdmin, {
      taskId: task.id,
      runId: run.id,
      ownerId: context.userId,
      urls: data.urls,
      topic: data.topic,
    });

    // Best-effort research_runs row
    const sourceCount = (result.result as any)?.source_count ?? 0;
    const { data: researchRow } = await supabaseAdmin
      .from("research_runs")
      .insert({
        user_id: context.userId,
        topic: data.topic,
        status: result.status === "completed" ? "completed" : "failed",
        sources: (result.result as any)?.sources ?? [],
        findings: [],
      })
      .select("id")
      .maybeSingle();

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "research.completed",
      target_type: "tasks",
      target_id: task.id,
      metadata: { run_id: run.id, source_count: sourceCount, status: result.status },
    });

    return {
      taskId: task.id,
      runId: run.id,
      researchId: researchRow?.id ?? null,
      sourceCount,
      status: result.status,
      warnings: result.warnings ?? [],
      errors: result.errors ?? [],
    };
  });

export const listMyResearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("research_runs")
      .select("id, topic, status, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
