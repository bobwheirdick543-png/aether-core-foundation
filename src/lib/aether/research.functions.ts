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
    return { topic: topic.slice(0, 300), urls, projectId: data?.projectId || null };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.projectId) {
      const { data: project, error: projectError } = await context.supabase.from("projects").select("id, owner_id").eq("id", data.projectId).eq("owner_id", context.userId).maybeSingle();
      if (projectError) throw new Error(`Could not validate project access: ${projectError.message}`);
      if (!project) throw new Error("Project not found or access denied");
    }
    const task = await createTask(supabaseAdmin, { owner_id: context.userId, project_id: data.projectId, title: `Research: ${data.topic}`, kind: "research", detail: { topic: data.topic, urls: data.urls }, status: "queued" });
    const run = await createRun(supabaseAdmin, { task_id: task.id, owner_id: context.userId, agent_key: "research", inputs: { topic: data.topic, urls: data.urls }, attempt: 1 });
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "research.queued", target_type: "tasks", target_id: task.id, metadata: { run_id: run.id, project_id: data.projectId, source_count_requested: data.urls.length } });
    return { taskId: task.id, runId: run.id, researchId: null, sourceCount: 0, status: "queued" as const, warnings: [], errors: [] };
  });

export const listMyResearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { projectId?: string }) => ({ projectId: data?.projectId || null }))
  .handler(async ({ context, data }) => {
    let query = context.supabase.from("aether_research_sessions").select("id, project_id, query, status, source_count, diversity_score, task_id, run_id, created_at, completed_at, last_event_at").eq("owner_id", context.userId).order("created_at", { ascending: false }).limit(50);
    if (data.projectId) {
      const { data: project } = await context.supabase.from("projects").select("id").eq("id", data.projectId).eq("owner_id", context.userId).maybeSingle();
      if (!project) throw new Error("Project not found or access denied");
      query = query.eq("project_id", data.projectId);
    }
    const { data: sessions, error } = await query;
    if (error) throw new Error(error.message);
    return sessions ?? [];
  });

export const getMyResearchSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => {
    const sessionId = String(data?.sessionId ?? "").trim();
    if (!sessionId) throw new Error("Research session id is required");
    return { sessionId };
  })
  .handler(async ({ context, data }) => {
    const { data: session, error } = await context.supabase.from("aether_research_sessions").select("*").eq("id", data.sessionId).eq("owner_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Research session not found or access denied");
    const [{ data: sources, error: sourcesError }, { data: plans, error: plansError }, { data: comparisons, error: comparisonsError }] = await Promise.all([
      context.supabase.from("aether_research_sources").select("*").eq("session_id", data.sessionId).eq("owner_id", context.userId).order("retrieved_at", { ascending: false }),
      context.supabase.from("aether_research_plans").select("*").eq("session_id", data.sessionId).eq("owner_id", context.userId).order("created_at", { ascending: false }),
      context.supabase.from("aether_research_comparisons").select("*").eq("session_id", data.sessionId).eq("owner_id", context.userId).order("created_at", { ascending: false }),
    ]);
    if (sourcesError) throw new Error(sourcesError.message);
    if (plansError) throw new Error(plansError.message);
    if (comparisonsError) throw new Error(comparisonsError.message);
    return { session, sources: sources ?? [], plans: plans ?? [], comparisons: comparisons ?? [] };
  });
