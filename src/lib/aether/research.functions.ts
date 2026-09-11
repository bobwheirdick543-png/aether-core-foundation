/**
 * AETHER RESEARCH SERVER FUNCTIONS
 * Uses the native research engine via the controlled executor.
 * No external AI. No fabricated findings.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isHttpUrl } from "./research-engine";
import { createTask, createRun } from "./task-service";

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

    // A project id is never accepted merely because it is syntactically valid.
    // The authenticated user's project membership/ownership must be established
    // before the durable task is created.
    if (data.projectId) {
      const { data: project, error: projectError } = await context.supabase
        .from("projects")
        .select("id, owner_id")
        .eq("id", data.projectId)
        .eq("owner_id", context.userId)
        .maybeSingle();
      if (projectError) throw new Error(`Could not validate project access: ${projectError.message}`);
      if (!project) throw new Error("Project not found or access denied");
    }

    // Research is queued into the universal runtime. Do not execute inside the
    // HTTP request: closing the browser must never cancel or orphan the work.
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

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "research.queued",
      target_type: "tasks",
      target_id: task.id,
      metadata: { run_id: run.id, project_id: data.projectId, source_count_requested: data.urls.length },
    });

    return {
      taskId: task.id,
      runId: run.id,
      researchId: null,
      sourceCount: 0,
      status: "queued" as const,
      warnings: [],
      errors: [],
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
