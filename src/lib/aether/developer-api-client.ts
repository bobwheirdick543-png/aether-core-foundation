export type AetherApiClientOptions = { baseUrl: string; apiKey: string; fetchImpl?: typeof fetch };
export type AetherApiError = { error?: { code?: string; message?: string; details?: unknown } };

export class AetherApiErrorResponse extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, payload: AetherApiError) {
    super(payload.error?.message ?? `Aether API request failed (${status})`);
    this.name = "AetherApiErrorResponse";
    this.status = status;
    this.code = payload.error?.code ?? "unknown_error";
    this.details = payload.error?.details;
  }
}

export function createAetherApiClient(options: AetherApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImpl(`${baseUrl}/api/v1/${path.replace(/^\//, "")}`, {
      ...init,
      headers: { Authorization: `Bearer ${options.apiKey}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new AetherApiErrorResponse(response.status, payload);
    return payload as T;
  }
  return {
    request,
    auth: () => request("auth"),
    projects: () => request("projects"),
    project: (id: string) => request(`projects/${encodeURIComponent(id)}`),
    conversations: () => request("conversations"),
    conversation: (id: string) => request(`conversations/${encodeURIComponent(id)}`),
    tasks: () => request("tasks"),
    createTask: (input: Record<string, unknown>) => request("tasks", { method: "POST", body: JSON.stringify(input) }),
    task: (id: string) => request(`tasks/${encodeURIComponent(id)}`),
    run: (id: string) => request(`runs/${encodeURIComponent(id)}`),
    agents: () => request("agents"),
    orchestration: () => request("orchestration"),
    memory: () => request("memory"),
    research: () => request("research"),
    knowledge: () => request("knowledge"),
    reports: () => request("reports"),
    notifications: () => request("notifications"),
    schedules: () => request("schedules"),
    modules: () => request("modules"),
    battleversia: (realm?: string) => request(`battleversia${realm ? `/${encodeURIComponent(realm)}` : ""}`),
    webhooks: () => request("webhooks"),
    logs: () => request("logs"),
  };
}
