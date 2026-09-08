/**
 * AETHER AGENT EVALUATION
 *
 * Metrics are derived only from real task_runs data.
 * No fabricated numbers. Empty when insufficient data.
 */

export interface AgentRunSample {
  status: string;
  started_at?: string | null;
  ended_at?: string | null;
}

export interface AgentEvaluationMetrics {
  totalRuns: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  waitingApproval: number;
  successRate: number | null;
  failureRate: number | null;
  avgDurationMs: number | null;
  hasSufficientData: boolean;
}

export function computeAgentMetrics(runs: AgentRunSample[]): AgentEvaluationMetrics {
  const total = runs.length;
  const succeeded = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const cancelled = runs.filter((r) => r.status === "cancelled").length;
  const waiting = runs.filter((r) => r.status === "waiting_approval").length;

  const finished = runs.filter((r) => r.started_at && r.ended_at);
  let avgDurationMs: number | null = null;
  if (finished.length > 0) {
    const sum = finished.reduce((acc, r) => {
      return acc + (new Date(r.ended_at!).getTime() - new Date(r.started_at!).getTime());
    }, 0);
    avgDurationMs = Math.round(sum / finished.length);
  }

  return {
    totalRuns: total,
    succeeded,
    failed,
    cancelled,
    waitingApproval: waiting,
    successRate: total > 0 ? succeeded / total : null,
    failureRate: total > 0 ? failed / total : null,
    avgDurationMs,
    hasSufficientData: total >= 1,
  };
}
