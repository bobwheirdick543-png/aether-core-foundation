/**
 * AETHER GLOBAL OBSERVABILITY
 *
 * Server-side only. This is the shared telemetry boundary for the platform:
 * request/task/run correlation, structured events, spans and metric samples.
 * Callers provide real execution facts; this module never invents activity.
 * Telemetry persistence is fail-open: an observability outage must not make
 * the primary Aether request or durable worker fail.
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

const SENSITIVE_KEYS = new Set([
  "authorization", "cookie", "set-cookie", "password", "secret", "token", "api_key", "apikey",
  "access_token", "refresh_token", "service_role_key", "private_key", "client_secret", "supabase_service_role_key",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[redacted-depth]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 4000) : value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    output[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(item, depth + 1);
  }
  return output;
}

function safeJson(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return redact(value) as Record<string, unknown>;
}

function safeMessage(message: string | undefined): string | null {
  if (!message) return null;
  return message.slice(0, 2000).replace(/(bearer\s+)[^\s]+/gi, "$1[redacted]");
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
    component: input.component.slice(0, 120),
    event_type: input.eventType.slice(0, 160),
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
    error_code: input.errorCode?.slice(0, 160) ?? null,
    metadata: safeJson(input.metadata),
  });
  if (error) console.error("[Aether observability] event write failed:", error.message);
}

export async function recordObservabilityMetric(input: {
  context?: ObservabilityContext;
  metricName: string;
  value: number;
  unit?: string;
  component: string;
  dimensions?: Record<string, unknown>;
}): Promise<void> {
  if (!Number.isFinite(input.value)) {
    console.error("[Aether observability] metric value was not finite");
    return;
  }
  const context = input.context;
  const { error } = await supabaseAdmin.from("aether_observability_metric_samples").insert({
    metric_name: input.metricName.slice(0, 160),
    value: input.value,
    unit: (input.unit ?? "count").slice(0, 40),
    component: input.component.slice(0, 120),
    sampled_at: new Date().toISOString(),
    trace_id: context?.traceId ?? null,
    request_id: context?.requestId ?? null,
    task_id: context?.taskId ?? null,
    run_id: context?.runId ?? null,
    dimensions: safeJson(input.dimensions),
  });
  if (error) console.error("[Aether observability] metric write failed:", error.message);
}

export async function startObservabilitySpan(input: {
  context: ObservabilityContext;
  name: string;
  component: string;
  parentSpanId?: string | null;
  attributes?: Record<string, unknown>;
}): Promise<{ spanId: string; finish: (status?: Exclude<ObservabilitySpanStatus, "running">, errorCode?: string | null) => Promise<void> }> {
  const spanId = randomUUID();
  const parentSpanId = input.parentSpanId ?? input.context.spanId ?? null;
  const startedAt = Date.now();
  const context = { ...input.context, spanId };
  const { error } = await supabaseAdmin.from("aether_observability_spans").insert({
    trace_id: context.traceId,
    span_id: spanId,
    parent_span_id: parentSpanId,
    name: input.name.slice(0, 200),
    component: input.component.slice(0, 120),
    status: "running",
    started_at: new Date(startedAt).toISOString(),
    user_id: context.userId ?? null,
    task_id: context.taskId ?? null,
    run_id: context.runId ?? null,
    worker_id: context.workerId ?? null,
    attributes: safeJson(input.attributes),
  });
  if (error) console.error("[Aether observability] span start failed:", error.message);

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
      if (finishError) console.error("[Aether observability] span finish failed:", finishError.message);
    },
  };
}
