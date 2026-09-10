export interface EvaluationInput {
  success: boolean;
  expectedOutputPresent: boolean;
  confidence?: number | null;
  errorClass?: "transient" | "provider" | "permission" | "validation" | "timeout" | "unknown" | null;
}

export function evaluateOrchestrationResult(input: EvaluationInput) {
  if (!input.success) {
    const retryable = input.errorClass === "transient" || input.errorClass === "provider" || input.errorClass === "timeout";
    return { accepted: false, status: retryable ? "retryable" : "failed", retryable, escalate: !retryable } as const;
  }
  if (!input.expectedOutputPresent) return { accepted: false, status: "incomplete", retryable: false, escalate: true } as const;
  if (input.confidence != null && input.confidence < 0.6) return { accepted: false, status: "needs_review", retryable: false, escalate: true } as const;
  return { accepted: true, status: "accepted", retryable: false, escalate: false } as const;
}

export function userSafeProgress(status: string, detail?: string) {
  const labels: Record<string, string> = {
    queued: "Queued",
    running: "Working",
    waiting_approval: "Waiting for your approval",
    paused: "Paused",
    retrying: "Retrying",
    completed: "Completed",
    failed: "Could not complete",
    cancelled: "Cancelled",
  };
  return detail ? `${labels[status] ?? "Working"}: ${detail}` : (labels[status] ?? "Working");
}
