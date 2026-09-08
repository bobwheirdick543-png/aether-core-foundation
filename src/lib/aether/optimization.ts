/**
 * AETHER OPTIMIZATION AGENT CONTRACTS
 *
 * Analyses real telemetry and produces recommendations.
 * NEVER silently changes production configuration or permissions.
 * Administrator must review and approve any change.
 */

export type RecommendationStatus = "pending" | "approved" | "rejected" | "applied" | "rolled_back";

export interface OptimizationRecommendation {
  id?: string;
  agent_key?: string | null;
  category: "latency" | "failures" | "retries" | "resources" | "workflow" | "config";
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
  suggested_change?: Record<string, unknown>;
  severity: "low" | "medium" | "high";
  status: RecommendationStatus;
  created_at?: string;
  decided_at?: string | null;
  decided_by?: string | null;
  decision_reason?: string | null;
}

/** Pure analysis helper — no side effects */
export function analyseRunStats(stats: {
  total: number;
  succeeded: number;
  failed: number;
  avgDurationMs?: number | null;
  timeoutCount?: number;
}): OptimizationRecommendation[] {
  const recs: OptimizationRecommendation[] = [];

  if (stats.total === 0) return recs;

  const failRate = stats.failed / stats.total;
  if (failRate > 0.25 && stats.total >= 5) {
    recs.push({
      category: "failures",
      title: "Elevated failure rate detected",
      description: `${Math.round(failRate * 100)}% of recent runs failed (${stats.failed}/${stats.total}). Investigate timeouts, input validation, or external dependencies.`,
      severity: failRate > 0.5 ? "high" : "medium",
      status: "pending",
      evidence: { failRate, total: stats.total, failed: stats.failed },
    });
  }

  if (stats.avgDurationMs && stats.avgDurationMs > 120_000) {
    recs.push({
      category: "latency",
      title: "High average execution time",
      description: `Average run duration is ${Math.round(stats.avgDurationMs / 1000)}s. Consider timeouts, concurrency limits, or source prioritisation.`,
      severity: stats.avgDurationMs > 300_000 ? "high" : "medium",
      status: "pending",
      evidence: { avgDurationMs: stats.avgDurationMs },
    });
  }

  if ((stats.timeoutCount ?? 0) > 0 && stats.total >= 3) {
    recs.push({
      category: "retries",
      title: "Timeouts observed",
      description: `${stats.timeoutCount} timeout(s) recorded. Review agent timeout_policy and external fetch limits.`,
      severity: "medium",
      status: "pending",
      evidence: { timeoutCount: stats.timeoutCount },
    });
  }

  return recs;
}
