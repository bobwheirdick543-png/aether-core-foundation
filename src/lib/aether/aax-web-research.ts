import type { SupabaseClient } from "@supabase/supabase-js";
import { isAaxHealthUsable, recordAaxHealth } from "./aax-reliability";

export type AaxWebSource = { url: string; title?: string; domain?: string; snippet?: string; citationIndex: number };
export type AaxWebResponse = { content: string; sources: AaxWebSource[]; tokensIn: number; tokensOut: number; latencyMs: number; providerModel: string };
type Model = { id: string; model_key: string; provider: string | null; provider_model: string | null; output_limit: number | null };

async function lookup(admin: SupabaseClient, modelKey: string): Promise<Model> {
  const { data, error } = await admin.rpc("get_available_aax_model", { p_model_key: modelKey });
  if (error) throw new Error(`AAX model lookup failed: ${error.message}`);
  const model = (Array.isArray(data) ? data[0] : data) as Model | undefined;
  if (!model) throw new Error(`AAX model '${modelKey}' is not available for execution`);
  if (model.provider !== "xai" || !model.provider_model) throw new Error("Web research requires an available xAI-backed AAX model");
  if (!process.env.XAI_API_KEY) throw new Error("Web research is not configured: XAI_API_KEY is missing");
  return model;
}

function textFromOutput(payload: any): string {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const chunks: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    if (item?.type !== "message") continue;
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("");
}

function sourcesFromPayload(payload: any): AaxWebSource[] {
  const urls = new Set<string>();
  const sources: AaxWebSource[] = [];
  const add = (url: unknown, title?: unknown, snippet?: unknown) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url) || urls.has(url)) return;
    urls.add(url);
    let domain = "";
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    sources.push({ url, title: typeof title === "string" ? title : undefined, snippet: typeof snippet === "string" ? snippet : undefined, domain, citationIndex: sources.length + 1 });
  };
  for (const url of Array.isArray(payload?.citations) ? payload.citations : []) add(url);
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) for (const annotation of Array.isArray(content?.annotations) ? content.annotations : []) add(annotation?.url, annotation?.title);
    for (const source of Array.isArray(item?.action?.sources) ? item.action.sources : []) add(source?.url, source?.title, source?.snippet);
  }
  return sources;
}

export async function executeAaxWebResearch(admin: SupabaseClient, input: { modelKey: string; messages: Array<{ role: "user" | "assistant" | "system"; content: string }>; maxOutputTokens?: number; signal?: AbortSignal; telemetry?: { userId?: string | null; taskId?: string | null; runId?: string | null } }): Promise<AaxWebResponse> {
  const model = await lookup(admin, input.modelKey);
  const health = await admin.from("aax_model_health").select("state,cooldown_until").eq("model_id", model.id).maybeSingle();
  if (health.error) throw new Error(`AAX health lookup failed: ${health.error.message}`);
  if (!isAaxHealthUsable(health.data)) throw new Error(`AAX model '${model.model_key}' is temporarily unavailable`);
  const started = Date.now();
  try {
    const response = await fetch("https://api.x.ai/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: model.provider_model, input: input.messages, tools: [{ type: "web_search" }], max_output_tokens: Math.min(Math.max(1, Math.floor(input.maxOutputTokens ?? model.output_limit ?? 4096)), model.output_limit ?? Number.MAX_SAFE_INTEGER) }), signal: input.signal });
    const raw = await response.text();
    let payload: any = null; try { payload = raw ? JSON.parse(raw) : null; } catch { /* provider error */ }
    const latencyMs = Date.now() - started;
    if (!response.ok) throw new Error(`AAX web research request failed (${response.status})`);
    const usage = payload?.usage ?? {};
    const tokensIn = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
    const tokensOut = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
    const sources = sourcesFromPayload(payload);
    const content = textFromOutput(payload);
    if (!content) throw new Error("Web research returned no answer");
    await recordAaxHealth(admin, model.id, "success", { latencyMs, webResearch: true, sourceCount: sources.length });
    if (input.telemetry) {
      const { error } = await admin.from("usage_logs").insert({ user_id: input.telemetry.userId ?? null, kind: "aax.chat.web_research", model_role: model.model_key, aax_model_id: model.id, provider: model.provider, provider_model: model.provider_model, tokens_in: tokensIn, tokens_out: tokensOut, latency_ms: latencyMs, status: "completed", task_id: input.telemetry.taskId ?? null, run_id: input.telemetry.runId ?? null });
      if (error) throw new Error(`AAX usage telemetry failed: ${error.message}`);
    }
    return { content, sources, tokensIn, tokensOut, latencyMs, providerModel: model.provider_model };
  } catch (error) {
    await recordAaxHealth(admin, model.id, "failure", { error: error instanceof Error ? error.message : String(error), latencyMs: Date.now() - started, webResearch: true });
    throw error;
  }
}
