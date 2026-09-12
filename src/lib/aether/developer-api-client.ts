export type AetherApiClientOptions = { baseUrl: string; apiKey: string; fetchImpl?: typeof fetch };
export type AetherApiError = { error?: { code?: string; message?: string; details?: unknown } };
export type AetherApiRequestOptions = RequestInit & { idempotencyKey?: string; requestId?: string };

export class AetherApiErrorResponse extends Error {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;
  constructor(status: number, payload: AetherApiError, requestId?: string) {
    super(payload.error?.message ?? `Aether API request failed (${status})`);
    this.name = "AetherApiErrorResponse";
    this.status = status;
    this.code = payload.error?.code ?? "unknown_error";
    this.details = payload.error?.details;
    this.requestId = requestId;
  }
}

export function createAetherApiClient(options: AetherApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  async function request<T>(path: string, init: AetherApiRequestOptions = {}): Promise<T> {
    const { idempotencyKey, requestId, ...requestInit } = init;
    const response = await fetchImpl(`${baseUrl}/api/v1/${path.replace(/^\//, "")}`, {
      ...requestInit,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        Accept: "application/json",
        ...(requestInit.body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        ...(requestId ? { "X-Request-Id": requestId } : {}),
        ...(requestInit.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    const responseRequestId = response.headers.get("X-Request-Id") ?? undefined;
    if (!response.ok) throw new AetherApiErrorResponse(response.status, payload, responseRequestId);
    return payload as T;
  }
  return {
    request,
    auth: () => request("auth"),
    projects: () => request("projects"),
    project: (id: string) => request(`projects/${encodeURIComponent(id)}`),
    conversations: () => request("conversations"),
    conversation: (id: string) => request(`conversations/${encodeURIComponent(id)}`),
    sendMessage: (input: Record<string, unknown>, idempotencyKey?: string) => request("conversations", { method: "POST", body: JSON.stringify(input), idempotencyKey }),
    tasks: () => request("tasks"),
    createTask: (input: Record<string, unknown>, idempotencyKey?: string) => request("tasks", { method: "POST", body: JSON.stringify(input), idempotencyKey }),
    task: (id: string) => request(`tasks/${encodeURIComponent(id)}`),
    run: (id: string) => request(`runs/${encodeURIComponent(id)}`),
    agents: () => request("agents"),
    models: () => request("models"),
    orchestration: () => request("orchestration"),
    memory: () => request("memory"),
    research: () => request("research"),
    knowledge: () => request("knowledge"),
    files: () => request("files"),
    file: (id: string) => request(`files/${encodeURIComponent(id)}`),
    reports: () => request("reports"),
    notifications: () => request("notifications"),
    schedules: () => request("schedules"),
    modules: () => request("modules"),
    battleversia: (realm?: string) => request(`battleversia${realm ? `/${encodeURIComponent(realm)}` : ""}`),
    webhooks: () => request("webhooks"),
    logs: () => request("logs"),
    usage: () => request("usage"),
  };
}
