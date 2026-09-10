export interface AaxProviderRequest {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: unknown }>;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface AaxProviderResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  rawUsage: Record<string, unknown>;
}

export interface AaxProviderAdapter {
  readonly provider: string;
  chat(request: AaxProviderRequest): Promise<AaxProviderResult>;
}

export function createOpenAiCompatibleAdapter(provider: string, baseUrl: string, apiKey: string): AaxProviderAdapter {
  return {
    provider,
    async chat(request) {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: request.model, messages: request.messages, max_tokens: request.maxTokens, ...(request.temperature === undefined ? {} : { temperature: request.temperature }), stream: false }),
        signal: request.signal,
      });
      const text = await response.text();
      let payload: any = null;
      try { payload = text ? JSON.parse(text) : null; } catch { /* handled below */ }
      if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Provider returned no assistant content");
      const usage = payload?.usage ?? {};
      return { content, tokensIn: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0), tokensOut: Number(usage.completion_tokens ?? usage.output_tokens ?? 0), rawUsage: usage };
    },
  };
}
