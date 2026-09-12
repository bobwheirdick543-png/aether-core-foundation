export type Z2ClientOptions = { baseUrl: string; apiKey: string; fetchImpl?: typeof fetch };
export type Z2Message = { role: "system" | "user" | "assistant"; content: string };
export type Z2IntelligenceInput = { messages: Z2Message[]; model?: string; webResearch?: boolean; temperature?: number; maxOutputTokens?: number; responseFormat?: "text" | "json" };

export async function createZ2Client(options: Z2ClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, ""); const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async intelligence(input: Z2IntelligenceInput, requestId?: string, idempotencyKey?: string) {
      const response = await fetchImpl(`${baseUrl}/api/v1/intelligence`, { method: "POST", headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json", Accept: "application/json", ...(requestId ? { "X-Request-Id": requestId } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, body: JSON.stringify(input) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(payload?.error?.message ?? `Aether Intelligence API failed (${response.status})`), { status: response.status, code: payload?.error?.code, requestId: response.headers.get("X-Request-Id") });
      return payload;
    },
  };
}
