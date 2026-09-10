export const AI_STAT_METRICS = [
  "intelligence",
  "speed",
  "response_time",
  "accuracy",
  "reasoning_quality",
  "knowledge_depth",
  "problem_solving",
  "adaptability",
  "learning_rate",
  "reliability",
  "tool_proficiency",
  "context_retention",
  "instruction_following",
  "research_quality",
  "verification_strength",
  "knowledge_connectivity",
  "communication_quality",
  "overall",
] as const;

export type AiStatMetric = (typeof AI_STAT_METRICS)[number];

export interface AiStatEvidence {
  reason: string;
  taskId?: string;
  runId?: string;
  knowledgeEventId?: string;
  evaluationId?: string;
  measurements: Record<string, number>;
}

export interface AiStatChange {
  metric: AiStatMetric;
  previousValue: string;
  delta: string;
  newValue: string;
  evidence: AiStatEvidence;
  createdAt: string;
}

/**
 * Statistics are deliberately unbounded. Values are represented as decimal strings
 * at the application boundary so growth beyond ordinary JS integer precision is safe.
 * A stat change must carry evidence; there is no automatic "knowledge learned = +1" rule.
 */
export function validateStatChange(change: AiStatChange): true {
  if (!AI_STAT_METRICS.includes(change.metric)) throw new Error("Unknown AI statistic");
  if (!change.evidence.reason.trim()) throw new Error("AI statistic changes require an evidence-backed reason");
  if (!Number.isFinite(Number(change.delta))) throw new Error("AI statistic delta must be finite");
  return true;
}
