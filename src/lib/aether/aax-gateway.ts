import type { SupabaseClient } from "@supabase/supabase-js";

export interface AaxChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AaxChatRequest {
  modelKey: string;
  messages: AaxChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  telemetry?: {
    userId?: string | null;
    taskId?: string | null;
    runId?: string | null;
    kind?: string;
  };
}

export interface AaxChatResponse {
  modelKey: string;
  modelId: string;
  provider: string;
  providerModel: string;
  content: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  rawUsage?: Record<string, unknown>;
}

type AvailableModel = {
  id: string;
  model_key: string;
  display_name: string;
  provider: string | null;
  provider_model: string | null;
  capabilities: string[];
  context_window: number;
  output_limit: number | null;
  release_status: string;
  available_at: string | null;
  config: Record<string, unknown>;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function providerConfig(provider: string): { baseUrl: string; apiKey: string } {
  if (provider === "xai") {
    return {
      baseUrl: (process.env.AETHER_XAI_BASE_URL ?? "https://api.x.ai/v1").replace(/\/$/, ""),
      apiKey: requiredEnv("XAI_API_KEY"),
    };
  }

  if (provider === "openai-compatible") {
    return {
      baseUrl: requiredEnv("AETHER_AAX_BASE_URL").replace(/\/$/, ""),
      apiKey: requiredEnv("AETHER_AAX_API_KEY"),
    };
  }

  throw new Error(`Unsupported AAX provider: ${provider}`);
}

function extractContent(payload: unknown): string {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === "string" ? part : (part as { text?: unknown })?.text)
      .filter((part): part is string => Boolean(part))
      .join("");
  }
  throw new Error("AAX provider returned no assistant content");
}

export async function executeAaxChat(
  admin: SupabaseClient,
  request: AaxChatRequest,
): Promise<AaxChatResponse> {
  if (!request.modelKey) throw new Error("AAX model key is required");
  if (!request.messages.length) throw new Error("AAX chat requires at least one message");

  const { data, error } = await admin.rpc("get_available_aax_model", {
    p_model_key: request.modelKey,
  });
  if (error) throw new Error(`AAX model lookup failed: ${error.message}`);

  const model = (Array.isArray(data) ? data[0] : data) as AvailableModel | undefined;
  if (!model) {
    throw new Error(`AAX model '${request.modelKey}' is not available for execution`);
  }
  if (!model.provider || !model.provider_model) {
    throw new Error(`AAX model '${request.modelKey}' is not configured with a provider model`);
  }

  const provider = providerConfig(model.provider);
  const maxOutputTokens = Math.min(
    Math.max(1, Math.floor(request.maxOutputTokens ?? model.output_limit ?? 4096)),
    model.output_limit ?? Number.MAX_SAFE_INTEGER,
  );
  const temperature = request.temperature === undefined
    ? undefined
    : Math.min(2, Math.max(0, request.temperature));

  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model.provider_model,
        messages: request.messages,
        ...(temperature === undefined ? {} : { temperature }),
        max_tokens: maxOutputTokens,
        stream: false,
      }),
      signal: request.signal,
    });
  } catch (error) {
    if (request.telemetry) {
      await admin.from("usage_logs").insert({
        user_id: request.telemetry.userId ?? null,
        kind: request.telemetry.kind ?? "aax.chat",
        model_role: model.model_key,
        aax_model_id: model.id,
        provider: model.provider,
        provider_model: model.provider_model,
        tokens_in: 0,
        tokens_out: 0,
        latency_ms: Date.now() - started,
        status: "failed",
        task_id: request.telemetry.taskId ?? null,
        run_id: request.telemetry.runId ?? null,
      });
    }
    throw error;
  }

  const rawText = await response.text();
  let payload: unknown = null;
  try { payload = rawText ? JSON.parse(rawText) : null; } catch { /* provider returned non-JSON */ }
  if (!response.ok) {
    if (request.telemetry) {
      await admin.from("usage_logs").insert({
        user_id: request.telemetry.userId ?? null,
        kind: request.telemetry.kind ?? "aax.chat",
        model_role: model.model_key,
        aax_model_id: model.id,
        provider: model.provider,
        provider_model: model.provider_model,
        tokens_in: 0,
        tokens_out: 0,
        latency_ms: Date.now() - started,
        status: "failed",
        task_id: request.telemetry.taskId ?? null,
        run_id: request.telemetry.runId ?? null,
      });
    }
    throw new Error(`AAX provider request failed (${response.status})`);
  }

  const usage = ((payload as { usage?: Record<string, unknown> } | null)?.usage ?? {});
  const tokensIn = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const tokensOut = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const latencyMs = Date.now() - started;

  if (request.telemetry) {
    const { error: telemetryError } = await admin.from("usage_logs").insert({
      user_id: request.telemetry.userId ?? null,
      kind: request.telemetry.kind ?? "aax.chat",
      model_role: model.model_key,
      aax_model_id: model.id,
      provider: model.provider,
      provider_model: model.provider_model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      latency_ms: latencyMs,
      status: "completed",
      task_id: request.telemetry.taskId ?? null,
      run_id: request.telemetry.runId ?? null,
    });
    if (telemetryError) throw new Error(`AAX usage telemetry failed: ${telemetryError.message}`);
  }

  return {
    modelKey: model.model_key,
    modelId: model.id,
    provider: model.provider,
    providerModel: model.provider_model,
    content: extractContent(payload),
    tokensIn,
    tokensOut,
    latencyMs,
    rawUsage: usage,
  };
}
