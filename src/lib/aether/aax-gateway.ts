import type { SupabaseClient } from "@supabase/supabase-js";
import { isAaxHealthUsable, recordAaxHealth } from "./aax-reliability";

export interface AaxChatMessage { role: "system" | "user" | "assistant" | "tool"; content: string; }
export interface AaxToolDefinition { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> }; }
export interface AaxToolCall { id: string; type: "function"; function: { name: string; arguments: string }; }
export interface AaxChatRequest {
  modelKey: string;
  messages: AaxChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  tools?: AaxToolDefinition[];
  toolChoice?: "auto" | "none";
  fallbackModelKeys?: string[];
  telemetry?: { userId?: string | null; taskId?: string | null; runId?: string | null; kind?: string };
}
export interface AaxChatResponse {
  modelKey: string; modelId: string; provider: string; providerModel: string; content: string;
  tokensIn: number; tokensOut: number; latencyMs: number; toolCalls?: AaxToolCall[]; rawUsage?: Record<string, unknown>;
}

type AvailableModel = {
  id: string; model_key: string; display_name: string; provider: string | null; provider_model: string | null;
  capabilities: string[]; context_window: number; output_limit: number | null; release_status: string;
  available_at: string | null; config: Record<string, unknown>;
};
function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`Missing server configuration: ${name}`); return value; }
function providerConfig(provider: string) {
  if (provider === "xai") return { baseUrl: (process.env.AETHER_XAI_BASE_URL ?? "https://api.x.ai/v1").replace(/\/$/, ""), apiKey: requiredEnv("XAI_API_KEY") };
  if (provider === "openai-compatible") return { baseUrl: requiredEnv("AETHER_AAX_BASE_URL").replace(/\/$/, ""), apiKey: requiredEnv("AETHER_AAX_API_KEY") };
  throw new Error(`Unsupported AAX provider: ${provider}`);
}
function extractContent(payload: unknown): string {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => typeof part === "string" ? part : (part as { text?: unknown })?.text).filter((part): part is string => Boolean(part)).join("");
  return "";
}
function extractToolCalls(payload: unknown): AaxToolCall[] {
  const calls = (payload as { choices?: Array<{ message?: { tool_calls?: unknown } }> })?.choices?.[0]?.message?.tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls.filter((call): call is AaxToolCall => Boolean(call) && typeof call === "object" && typeof (call as AaxToolCall).id === "string" && (call as AaxToolCall).function?.name !== undefined);
}

async function lookupModel(admin: SupabaseClient, modelKey: string): Promise<AvailableModel> {
  const { data, error } = await admin.rpc("get_available_aax_model", { p_model_key: modelKey });
  if (error) throw new Error(`AAX model lookup failed: ${error.message}`);
  const model = (Array.isArray(data) ? data[0] : data) as AvailableModel | undefined;
  if (!model) throw new Error(`AAX model '${modelKey}' is not available for execution`);
  if (!model.provider || !model.provider_model) throw new Error(`AAX model '${modelKey}' is not configured with a provider model`);
  return model;
}

async function sendOnce(admin: SupabaseClient, model: AvailableModel, request: AaxChatRequest): Promise<AaxChatResponse> {
  const health = await admin.from("aax_model_health").select("state,cooldown_until").eq("model_id", model.id).maybeSingle();
  if (health.error) throw new Error(`AAX health lookup failed: ${health.error.message}`);
  if (!isAaxHealthUsable(health.data)) throw new Error(`AAX model '${model.model_key}' is temporarily unavailable`);
  const provider = providerConfig(model.provider!);
  const maxOutputTokens = Math.min(Math.max(1, Math.floor(request.maxOutputTokens ?? model.output_limit ?? 4096)), model.output_limit ?? Number.MAX_SAFE_INTEGER);
  const temperature = request.temperature === undefined ? undefined : Math.min(2, Math.max(0, request.temperature));
  const started = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST", headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.provider_model, messages: request.messages, ...(temperature === undefined ? {} : { temperature }), max_tokens: maxOutputTokens, stream: false, ...(request.tools?.length ? { tools: request.tools, tool_choice: request.toolChoice ?? "auto" } : {}) }),
      signal: request.signal,
    });
    const rawText = await response.text();
    let payload: unknown = null; try { payload = rawText ? JSON.parse(rawText) : null; } catch { /* non-JSON provider error */ }
    const latencyMs = Date.now() - started;
    if (!response.ok) throw new Error(`AAX provider request failed (${response.status})`);
    const usage = ((payload as { usage?: Record<string, unknown> } | null)?.usage ?? {});
    const tokensIn = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
    const tokensOut = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
    await recordAaxHealth(admin, model.id, "success", { latencyMs });
    if (request.telemetry) {
      const { error } = await admin.from("usage_logs").insert({ user_id: request.telemetry.userId ?? null, kind: request.telemetry.kind ?? "aax.chat", model_role: model.model_key, aax_model_id: model.id, provider: model.provider, provider_model: model.provider_model, tokens_in: tokensIn, tokens_out: tokensOut, latency_ms: latencyMs, status: "completed", task_id: request.telemetry.taskId ?? null, run_id: request.telemetry.runId ?? null });
      if (error) throw new Error(`AAX usage telemetry failed: ${error.message}`);
    }
    return { modelKey: model.model_key, modelId: model.id, provider: model.provider!, providerModel: model.provider_model!, content: extractContent(payload), tokensIn, tokensOut, latencyMs, toolCalls: extractToolCalls(payload), rawUsage: usage };
  } catch (error) {
    await recordAaxHealth(admin, model.id, "failure", { error: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - started });
    throw error;
  }
}

export async function executeAaxChat(admin: SupabaseClient, request: AaxChatRequest): Promise<AaxChatResponse> {
  if (!request.modelKey) throw new Error("AAX model key is required");
  if (!request.messages.length) throw new Error("AAX chat requires at least one message");
  const keys = [request.modelKey, ...(request.fallbackModelKeys ?? []).filter((key) => key !== request.modelKey)];
  let lastError: unknown;
  for (let index = 0; index < keys.length; index += 1) {
    const modelKey = keys[index];
    try {
      const model = await lookupModel(admin, modelKey);
      const response = await sendOnce(admin, model, { ...request, modelKey });
      if (index > 0) await recordAaxHealth(admin, response.modelId, "success", { fallback: true });
      return response;
    } catch (error) {
      lastError = error;
      if (request.signal?.aborted) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All AAX model candidates failed");
}

export async function executeAaxChatStream(admin: SupabaseClient, request: AaxChatRequest, onToken: (token: string) => void): Promise<AaxChatResponse> {
  if (!request.modelKey || !request.messages.length) throw new Error("AAX streaming request requires a model and at least one message");
  const model = await lookupModel(admin, request.modelKey);
  const health = await admin.from("aax_model_health").select("state,cooldown_until").eq("model_id", model.id).maybeSingle();
  if (health.error) throw new Error(health.error.message);
  if (!isAaxHealthUsable(health.data)) throw new Error(`AAX model '${model.model_key}' is temporarily unavailable`);
  const provider = providerConfig(model.provider!);
  const started = Date.now();
  const response = await fetch(`${provider.baseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ model: model.provider_model, messages: request.messages, max_tokens: Math.min(Math.max(1, Math.floor(request.maxOutputTokens ?? model.output_limit ?? 4096)), model.output_limit ?? Number.MAX_SAFE_INTEGER), ...(request.temperature === undefined ? {} : { temperature: Math.min(2, Math.max(0, request.temperature)) }), stream: true, ...(request.tools?.length ? { tools: request.tools, tool_choice: request.toolChoice ?? "auto" } : {}) }), signal: request.signal });
  if (!response.ok || !response.body) { await recordAaxHealth(admin, model.id, "failure", { error: `stream request failed (${response.status})` }); throw new Error(`AAX streaming request failed (${response.status})`); }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let content = ""; let usage: Record<string, unknown> = {};
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim(); if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim(); if (data === "[DONE]") continue;
        try { const event = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }>; usage?: Record<string, unknown> }; const token = event.choices?.[0]?.delta?.content ?? ""; if (token) { content += token; onToken(token); } if (event.usage) usage = event.usage; } catch { /* ignore malformed SSE frame */ }
      }
    }
    const latencyMs = Date.now() - started; const tokensIn = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0); const tokensOut = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
    await recordAaxHealth(admin, model.id, "success", { latencyMs });
    if (request.telemetry) await admin.from("usage_logs").insert({ user_id: request.telemetry.userId ?? null, kind: request.telemetry.kind ?? "aax.chat.stream", model_role: model.model_key, aax_model_id: model.id, provider: model.provider, provider_model: model.provider_model, tokens_in: tokensIn, tokens_out: tokensOut, latency_ms: latencyMs, status: "completed", task_id: request.telemetry.taskId ?? null, run_id: request.telemetry.runId ?? null });
    return { modelKey: model.model_key, modelId: model.id, provider: model.provider!, providerModel: model.provider_model!, content, tokensIn, tokensOut, latencyMs, rawUsage: usage };
  } catch (error) { await recordAaxHealth(admin, model.id, "failure", { error: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - started }); throw error; }
}
