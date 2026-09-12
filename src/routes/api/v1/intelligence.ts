import { createFileRoute } from "@tanstack/react-router";
import { assertRequestSize } from "@/lib/aether/security-boundary";
import { authenticateZ2ApiKey, executeZ2Intelligence } from "@/lib/aether/phase-z2-api";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;

export const Route = createFileRoute("/api/v1/intelligence")({ server: { handlers: {
  POST: ({ request }) => handle(request),
  OPTIONS: async () => new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id, Idempotency-Key", "Access-Control-Allow-Methods": "POST, OPTIONS" } }),
} } });

function requestIdFrom(request: Request) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : `req_${crypto.randomUUID().replaceAll("-", "")}`;
}

function errorResponse(status: number, code: string, message: string, requestId: string) {
  return new Response(JSON.stringify({ error: { code, message, requestId } }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Request-Id": requestId, "Access-Control-Allow-Origin": "*" } });
}

async function handle(request: Request) {
  const started = Date.now();
  const requestId = requestIdFrom(request);
  let identity: Awaited<ReturnType<typeof authenticateZ2ApiKey>> = null;
  let statusCode = 500;
  try {
    assertRequestSize(request);
    identity = await authenticateZ2ApiKey(request);
    if (!identity) { statusCode = 401; return errorResponse(401, "invalid_api_key", "A valid Aether Ascension API key is required", requestId); }
    if (identity.status !== "active") { statusCode = 403; return errorResponse(403, "api_key_not_active", "This Aether API key is not currently authorized", requestId); }
    if (request.headers.get("content-type")?.includes("application/json") !== true) { statusCode = 415; return errorResponse(415, "unsupported_media_type", "Requests must use application/json", requestId); }
    let body: any;
    try { body = await request.json(); } catch { statusCode = 400; return errorResponse(400, "invalid_json", "Request body must contain valid JSON", requestId); }
    const result = await executeZ2Intelligence(request, identity, body, requestId);
    statusCode = result.status;
    return new Response(JSON.stringify(result.responseBody), { status: result.status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Request-Id": requestId, "X-AAX-Model": identity.modelKey, "Access-Control-Allow-Origin": "*" } });
  } catch (error) {
    if (error instanceof Response) { statusCode = error.status; error.headers.set("X-Request-Id", requestId); error.headers.set("Access-Control-Allow-Origin", "*"); return error; }
    statusCode = 500;
    return errorResponse(500, "internal_error", "Aether Intelligence API request failed", requestId);
  } finally {
    await db.from("aether_api_logs").insert({ api_key_id: identity?.apiKeyId ?? null, owner_id: identity?.ownerId ?? null, method: request.method, path: "/api/v1/intelligence", status_code: statusCode, latency_ms: Math.max(0, Date.now() - started), request_id: requestId, api_version: "z2", application_name: identity?.applicationName ?? null, environment: identity?.environment ?? null, model_id: identity?.modelId ?? null, model_key: identity?.modelKey ?? null, metadata: { apiKind: "aax", modelGeneration: identity?.modelGeneration ?? null, modelRevision: identity?.modelRevision ?? null } });
  }
}
