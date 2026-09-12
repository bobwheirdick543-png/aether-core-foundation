import { createFileRoute } from "@tanstack/react-router";
import { apiError, authenticateDeveloperApiKey, handleDeveloperApi, logApiRequest } from "@/lib/aether/developer-api";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      GET: (ctx) => handle(ctx),
      POST: (ctx) => handle(ctx),
      PUT: (ctx) => handle(ctx),
      PATCH: (ctx) => handle(ctx),
      DELETE: (ctx) => handle(ctx),
      OPTIONS: async () => new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" } }),
    },
  },
});

async function handle({ request }: { request: Request }) {
  const started = Date.now();
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/v1\/?/, "").replace(/\/+$/, "");
  const segments = path ? path.split("/").filter(Boolean).map(decodeURIComponent) : [];
  let identity: Awaited<ReturnType<typeof authenticateDeveloperApiKey>> = null;
  let status = 200;
  try {
    identity = await authenticateDeveloperApiKey(request);
    if (!identity) { status = 401; return apiError(401, "invalid_api_key", "A valid Aether API key is required"); }
    const security = await authorizeDeveloperRequest(identity.ownerId, request, path);
    if (!security.allowed) { status = security.requiresApproval ? 202 : 403; return apiError(status, security.requiresApproval ? "approval_required" : "security_denied", security.reason ?? "Developer API request was blocked by the security policy", { requestId: security.requestId }); }
    let body: unknown = {};
    if (["POST","PUT","PATCH"].includes(request.method)) {
      const contentType = request.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) { status = 415; return apiError(415, "unsupported_media_type", "Requests with a body must use application/json"); }
      body = await request.json();
    }
    const response = await handleDeveloperApi(request, identity, segments, body);
    status = response.status;
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("X-Request-Id", request.headers.get("x-request-id") ?? crypto.randomUUID());
    return response;
  } catch (error) {
    if (error instanceof Response) { status = error.status; return error; }
    status = 500;
    return apiError(500, "internal_error", error instanceof Error ? error.message : "Internal API error");
  } finally {
    if (identity) await logApiRequest(identity, request, `/api/v1/${path}`, status, started);
  }
}

async function authorizeDeveloperRequest(ownerId: string, request: Request, path: string) {
  const resource = path.split("/")[0] || "root";
  const action = `api.${request.method.toLowerCase()}.${resource}`;
  const idempotency = request.headers.get("x-request-id") || crypto.randomUUID();
  const { data, error } = await (supabaseAdmin as any).rpc("security_authorize_action", {
    p_idempotency_key: `developer-api:${idempotency}`,
    p_actor_id: ownerId,
    p_agent_key: "developer-api",
    p_action: action,
    p_resource_type: resource,
    p_resource_id: path,
    p_context: { api_version: "v1", method: request.method },
  });
  if (error) throw new Error(`Security authorization failed: ${error.message}`);
  return data as { allowed: boolean; requires_approval: boolean; decision: string; reason?: string; request_id?: string };
}
