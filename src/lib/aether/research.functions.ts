/**
 * AETHER RESEARCH SERVER FUNCTIONS
 * Uses the native research engine. No external AI. No fabricated findings.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { retrievePage, toSourceMeta, isHttpUrl } from "./research-engine";
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

    // Create durable task + run
    const task = await createTask(supabaseAdmin, {
      owner_id: context.userId,
      project_id: data.projectId,
      title: `Research: ${data.topic}`,
      kind: "research",
      detail: { topic: data.topic, urls: data.urls },
      status: "running",
    });

    const run = await createRun(supabaseAdmin, {
      task_id: task.id,
      owner_id: context.userId,
      agent_key: "research",
      inputs: { topic: data.topic, urls: data.urls },
      attempt: 1,
    });

    // Perform actual retrieval (no AI)
    const pages = [];
    for (const url of data.urls) {
      const page = await retrievePage(url);
      pages.push(page);
    }

    const sources = pages
      .filter((p) => !p.error && p.status >= 200 && p.status < 400)
      .map(toSourceMeta);

    // Persist research run record if table exists
    const { data: researchRow } = await supabaseAdmin
      .from("research_runs")
      .insert({
        user_id: context.userId,
        topic: data.topic,
        status: pages.length > 0 ? "completed" : "failed",
        sources: sources,
        findings: [], // no fabricated findings
      })
      .select("id")
      .maybeSingle();

    // Store sources
    for (const src of sources) {
      await supabaseAdmin.from("research_sources").insert({
        run_id: researchRow?.id ?? null,
        url: src.url,
        domain: src.domain,
        title: src.title,
        content_hash: src.contentHash,
        retrieved_at: src.retrievedAt,
      }).select().maybeSingle();
    }

    // Update run + task
    await supabaseAdmin
      .from("task_runs")
      .update({
        status: "completed",
        outputs: { source_count: sources.length, pages: pages.map((p) => ({ url: p.url, status: p.status, title: p.title, error: p.error })) },
        ended_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    await supabaseAdmin
      .from("tasks")
      .update({
        status: "completed",
        progress: 100,
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "research.completed",
      target_type: "tasks",
      target_id: task.id,
      metadata: { run_id: run.id, source_count: sources.length },
    });

    return {
      taskId: task.id,
      runId: run.id,
      researchId: researchRow?.id ?? null,
      sourceCount: sources.length,
      pages: pages.map((p) => ({
        url: p.url,
        status: p.status,
        title: p.title,
        error: p.error,
        textLength: p.text.length,
      })),
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
