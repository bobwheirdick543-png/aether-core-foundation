/**
 * ADMIN OPTIMIZATION SCAN
 * Reads real run telemetry and produces recommendations.
 * Never applies changes automatically.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analyseRunStats } from "@/lib/aether/optimization";
import { computeAgentMetrics } from "@/lib/aether/evaluation";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const runOptimizationScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: runs } = await supabaseAdmin
      .from("task_runs")
      .select("id, agent_id, agent_key, status, started_at, ended_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const all = runs ?? [];
    const metrics = computeAgentMetrics(all);

    const recommendations = analyseRunStats({
      total: metrics.totalRuns,
      succeeded: metrics.succeeded,
      failed: metrics.failed,
      avgDurationMs: metrics.avgDurationMs,
      timeoutCount: all.filter((r) => r.status === "failed").length, // approximate
    });

    // Group by agent_key when present
    const byAgent = new Map<string, typeof all>();
    for (const r of all) {
      const key = (r.agent_key as string) || "unknown";
      if (!byAgent.has(key)) byAgent.set(key, []);
      byAgent.get(key)!.push(r);
    }

    const perAgent = Array.from(byAgent.entries()).map(([key, agentRuns]) => {
      const m = computeAgentMetrics(agentRuns);
      return {
        agent_key: key,
        metrics: m,
        recommendations: analyseRunStats({
          total: m.totalRuns,
          succeeded: m.succeeded,
          failed: m.failed,
          avgDurationMs: m.avgDurationMs,
        }),
      };
    });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "optimization.scan",
      target_type: "task_runs",
      metadata: {
        total_runs: metrics.totalRuns,
        recommendation_count: recommendations.length,
      },
    });

    return {
      global: { metrics, recommendations },
      perAgent,
      scannedAt: new Date().toISOString(),
      note: "Recommendations only. No configuration was changed.",
    };
  });
