import { createFileRoute } from "@tanstack/react-router";
import { apiError, authenticateDeveloperApiKey, handleDeveloperApi, logApiRequest } from "@/lib/aether/developer-api";

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
    if (!identity) identity = await authenticateDeveloperApiKey(request);
    if (!identity) { status = 401; return apiError(401, "invalid_api_key", "A valid Aether API key is required"); }
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
