import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrchestrationTraceInput {
  planId: string;
  taskId: string;
  runId?: string | null;
  stepId?: string | null;
  actorId: string;
  actorType: "user" | "admin" | "orchestrator" | "agent" | "system";
  eventType: string;
  action: string;
  reason?: string;
  decision?: string;
  data?: Record<string, unknown>;
}

/** Central trace writer for Phase B. Callers should pass identifiers and safe metadata only. */
export async function traceOrchestrationEvent(admin: SupabaseClient, input: OrchestrationTraceInput) {
  const { error } = await admin.rpc("append_orchestration_event", {
    p_plan_id: input.planId,
    p_event_type: input.eventType,
    p_actor_type: input.actorType,
    p_actor_id: input.actorId,
    p_task_id: input.taskId,
    p_run_id: input.runId ?? null,
    p_step_id: input.stepId ?? null,
    p_action: input.action,
    p_reason: input.reason ?? null,
    p_decision: input.decision ?? null,
    p_data: input.data ?? {},
  });
  if (error) throw new Error(`Failed to record orchestration trace: ${error.message}`);
}
