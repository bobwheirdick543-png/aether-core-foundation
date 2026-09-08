/**
 * User research runs — owner-scoped.
 * Creating a run records a real row in status queued.
 * No fabricated sources, findings, or AI answers.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyResearchRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: runs } = await context.supabase
      .from("research_runs")
      .select("id, topic, depth, duration_minutes, source_types, status, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    const ids = (runs ?? []).map((r) => r.id);
    const sourceCounts: Record<string, number> = {};
    const findingCounts: Record<string, number> = {};

    if (ids.length > 0) {
      const { data: sources } = await context.supabase
        .from("research_sources")
        .select("run_id")
        .eq("user_id", context.userId)
        .in("run_id", ids);
      const { data: findings } = await context.supabase
        .from("research_findings")
        .select("run_id")
        .eq("user_id", context.userId)
        .in("run_id", ids);

      for (const s of sources ?? []) {
        sourceCounts[s.run_id] = (sourceCounts[s.run_id] ?? 0) + 1;
      }
      for (const f of findings ?? []) {
        findingCounts[f.run_id] = (findingCounts[f.run_id] ?? 0) + 1;
      }
    }

    return (runs ?? []).map((r) => ({
      ...r,
      sourceCount: sourceCounts[r.id] ?? 0,
      findingCount: findingCounts[r.id] ?? 0,
    }));
  });

export const createMyResearchRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { topic: string; depth?: string; durationMinutes?: number }) => {
    const topic = String(data?.topic ?? "").trim().slice(0, 500);
    if (topic.length < 3) throw new Error("Topic must be at least 3 characters.");
    const depth = String(data?.depth ?? "basic").trim().slice(0, 32) || "basic";
    const durationMinutes = Math.min(
      240,
      Math.max(1, Number(data?.durationMinutes ?? 5) || 5),
    );
    return { topic, depth, durationMinutes };
  })
  .handler(async ({ context, data }) => {
    const { data: task } = await context.supabase
      .from("tasks")
      .insert({
        user_id: context.userId,
        title: `Research: ${data.topic.slice(0, 120)}`,
        kind: "research",
        status: "queued",
        progress: 0,
        detail: { topic: data.topic, depth: data.depth },
      })
      .select("id")
      .maybeSingle();

    const { data: run, error } = await context.supabase
      .from("research_runs")
      .insert({
        user_id: context.userId,
        task_id: task?.id ?? null,
        topic: data.topic,
        depth: data.depth,
        duration_minutes: data.durationMinutes,
        source_types: ["web"],
        status: "queued",
      })
      .select("id, topic, depth, duration_minutes, status, created_at")
      .single();

    if (error || !run) {
      return { ok: false as const, message: "Could not create research run." };
    }

    if (task?.id) {
      await context.supabase.from("task_runs").insert({
        task_id: task.id,
        owner_id: context.userId,
        attempt: 1,
        status: "queued",
        inputs: { research_run_id: run.id, topic: data.topic },
        outputs: {},
        idempotency_key: `research:${run.id}:attempt:1`,
      });
    }

    const shortTopic = data.topic.slice(0, 80);
    await context.supabase.from("notifications").insert({
      recipient_id: context.userId,
      audience: "user",
      event_type: "research.queued",
      title: "Research run queued",
      body: `"${shortTopic}" is queued. Findings appear only after a research worker executes.`,
      resource_type: "research_runs",
      resource_id: run.id,
      link: "/research",
      status: "delivered",
      delivered_at: new Date().toISOString(),
    });

    return { ok: true as const, run };
  });
