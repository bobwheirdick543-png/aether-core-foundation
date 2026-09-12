/**
 * AETHER GLOBAL OBSERVABILITY
 *
 * Server-side only. This is the shared telemetry boundary for the platform:
 * request/task/run correlation, structured events, spans and metric samples.
 * Callers provide real execution facts; this module never invents activity.
 */

import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ObservabilityLevel = "debug" | "info" | "warn" | "error";
export type ObservabilitySpanStatus = "running" | "completed" | "failed" | "cancelled";

export interface ObservabilityContext {
  traceId: string;
  requestId?: string;
  spanId?: string;
  userId?: string | null;
  taskId?: string | null;
  runId?: string | null;
  workerId?: string | null;
  agentKey?: string | null;
  modelId?: string | null;
}

export function createObservabilityContext(seed: Partial<ObservabilityContext> = {}): ObservabilityContext {
  return {
    traceId: seed.traceId ?? randomUUID(),
    requestId: seed.requestId ?? randomUUID(),
    spanId: seed.spanId,
    userId: seed.userId,
    taskId: seed.taskId,
    runId: seed.runId,
    workerId: seed.workerId,
    agentKey: seed.agentKey,
    modelId: seed.modelId,
  };
}

function safeJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function safeMessage(message: string | undefined): string | null {
  if (!message) return null;
  return message.slice(0, 2000);
}

export async function recordObservabilityEvent(input: {
  context: ObservabilityContext;
  level?: ObservabilityLevel;
  component: string;
  eventType: string;
  message?: string;
  durationMs?: number | null;
  success?: boolean | null;
  retryable?: boolean | null;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { context } = input;
  const { error } = await supabaseAdmin.from("aether_observability_events").insert({
    level: input.level ?? "info",
    component: input.component,
    event_type: input.eventType,
    message: safeMessage(input.message),
    trace_id: context.traceId,
    request_id: context.requestId ?? null,
    span_id: context.spanId ?? null,
    user_id: context.userId ?? null,
    task_id: context.taskId ?? null,
    run_id: context.runId ?? null,
    worker_id: context.workerId ?? null,
    agent_key: context.agentKey ?? null,
    model_id: context.modelId ?? null,
    duration_ms: input.durationMs ?? null,
    success: input.success ?? null,
    retryable: input.retryable ?? null,
    error_code: input.errorCode ?? null,
    metadata: safeJson(input.metadata),
  });
  if (error) throw new Error(`Observability event write failed: ${error.message}`);
}

export async function recordObservabilityMetric(input: {
  context?: ObservabilityContext;
  metricName: string;
  value: number;
  unit?: string;
  component: string;
  dimensions?: Record<string, unknown>;
}): Promise<void> {
  if (!Number.isFinite(input.value)) throw new Error("Observability metric value must be finite");
  const context = input.context;
  const { error } = await supabaseAdmin.from("aether_observability_metric_samples").insert({
    metric_name: input.metricName,
    value: input.value,
    unit: input.unit ?? "count",
    component: input.component,
    sampled_at: new Date().toISOString(),
    trace_id: context?.traceId ?? null,
    request_id: context?.requestId ?? null,
    task_id: context?.taskId ?? null,
    run_id: context?.runId ?? null,
    dimensions: safeJson(input.dimensions),
  });
  if (error) throw new Error(`Observability metric write failed: ${error.message}`);
}

export async function startObservabilitySpan(input: {
  context: ObservabilityContext;
  name: string;
  component: string;
  parentSpanId?: string | null;
  attributes?: Record<string, unknown>;
}): Promise<{ spanId: string; finish: (status?: Exclude<ObservabilitySpanStatus, "running">, errorCode?: string | null) => Promise<void> }> {
  const spanId = randomUUID();
  const startedAt = Date.now();
  const context = { ...input.context, spanId };
  const { error } = await supabaseAdmin.from("aether_observability_spans").insert({
    trace_id: context.traceId,
    span_id: spanId,
    parent_span_id: input.parentSpanId ?? context.spanId ?? null,
    name: input.name.slice(0, 200),
    component: input.component,
    status: "running",
    started_at: new Date(startedAt).toISOString(),
    user_id: context.userId ?? null,
    task_id: context.taskId ?? null,
    run_id: context.runId ?? null,
    worker_id: context.workerId ?? null,
    attributes: safeJson(input.attributes),
  });
  if (error) throw new Error(`Observability span start failed: ${error.message}`);

  return {
    spanId,
    finish: async (status = "completed", errorCode = null) => {
      const endedAt = Date.now();
      const { error: finishError } = await supabaseAdmin.from("aether_observability_spans").update({
        status,
        ended_at: new Date(endedAt).toISOString(),
        duration_ms: Math.max(0, endedAt - startedAt),
        error_code: errorCode,
      }).eq("span_id", spanId).eq("status", "running");
      if (finishError) throw new Error(`Observability span finish failed: ${finishError.message}`);
    },
  };
}
