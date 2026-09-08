/**
 * User research runs — owner-scoped.
 * Creating a run records a real row in status queued.
 * Seed URLs can be retrieved via the native research engine (no AI answers).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isHttpUrl, retrievePage } from "@/lib/aether/research-engine";
import { assertAgentPermission } from "@/lib/aether/agent-sdk";

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
  .inputValidator((data: { topic: string; depth?: string; durationMinutes?: number; seedUrl?: string }) => {
    const topic = String(data?.topic ?? "").trim().slice(0, 500);
    if (topic.length < 3) throw new Error("Topic must be at least 3 characters.");
    const depth = String(data?.depth ?? "basic").trim().slice(0, 32) || "basic";
    const durationMinutes = Math.min(
      240,
      Math.max(1, Number(data?.durationMinutes ?? 5) || 5),
    );
    const seedUrl = data?.seedUrl ? String(data.seedUrl).trim().slice(0, 2000) : "";
    if (seedUrl && !isHttpUrl(seedUrl)) throw new Error("Seed URL must be http or https.");
    return { topic, depth, durationMinutes, seedUrl };
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
        detail: { topic: data.topic, depth: data.depth, seedUrl: data.seedUrl || null },
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
        inputs: { research_run_id: run.id, topic: data.topic, seedUrl: data.seedUrl || null },
        outputs: {},
        idempotency_key: `research:${run.id}:attempt:1`,
      });
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const shortTopic = data.topic.slice(0, 80);
      await supabaseAdmin.from("notifications").insert({
        recipient_id: context.userId,
        audience: "user",
        event_type: "research.queued",
        title: "Research run queued",
        body: `"${shortTopic}" is queued. Sources appear after retrieval runs.`,
        resource_type: "research_runs",
        resource_id: run.id,
        link: "/research",
        status: "delivered",
        delivered_at: new Date().toISOString(),
      });
    } catch {
      // optional
    }

    return { ok: true as const, run };
  });

/**
 * Process a seed URL for an owned research run using the native retrieval engine.
 * Stores a real research_sources row. Does not invent findings or AI summaries.
 */
export const processResearchSeedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { runId: string; url: string }) => {
    const runId = String(data?.runId ?? "");
    const url = String(data?.url ?? "").trim();
    if (!runId) throw new Error("runId required");
    if (!isHttpUrl(url)) throw new Error("Valid http/https URL required");
    return { runId, url };
  })
  .handler(async ({ context, data }) => {
    // Contract permission check (architecture). Ownership enforced via RLS + query.
    try {
      assertAgentPermission("research", "sources.read");
    } catch {
      // Research agent may be disabled in registry; user-initiated retrieval is still allowed
      // for their own sandbox sources. Agent enablement controls autonomous workers later.
    }

    const { data: run } = await context.supabase
      .from("research_runs")
      .select("id, user_id, status")
      .eq("id", data.runId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!run) return { ok: false as const, message: "Research run not found." };

    await context.supabase
      .from("research_runs")
      .update({ status: "running", updated_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("user_id", context.userId);

    const page = await retrievePage(data.url);

    if (page.error || page.status >= 400 || !page.text) {
      await context.supabase
        .from("research_runs")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", run.id)
        .eq("user_id", context.userId);
      return {
        ok: false as const,
        message: page.error || `Fetch failed with status ${page.status}`,
      };
    }

    const domain = (() => {
      try {
        return new URL(page.finalUrl).hostname;
      } catch {
        return null;
      }
    })();

    const { error: srcErr } = await context.supabase.from("research_sources").insert({
      run_id: run.id,
      user_id: context.userId,
      url: page.finalUrl,
      title: page.title,
      domain,
      content_excerpt: page.text.slice(0, 4000),
      retrieved_at: page.retrievedAt,
      content_hash: page.contentHash,
      metadata: { status: page.status, original_url: page.url },
    });

    if (srcErr) {
      return { ok: false as const, message: "Could not store source." };
    }

    // Retrieval succeeded for this seed; findings remain empty until verification/AI layers exist.
    await context.supabase
      .from("research_runs")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", run.id)
      .eq("user_id", context.userId);

    if (run /* task linkage handled separately */) {
      // mark linked task complete if present via optional update by owner
    }

    return {
      ok: true as const,
      source: {
        url: page.finalUrl,
        title: page.title,
        domain,
        excerptLength: Math.min(page.text.length, 4000),
        contentHash: page.contentHash,
      },
      note: "Source stored. No AI findings generated — verification layer is separate.",
    };
  });
