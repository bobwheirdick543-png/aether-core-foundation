import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { apiError, authenticateDeveloperApiKey, handleDeveloperApi, logApiRequest, requireScope } from "@/lib/aether/developer-api";
import { executeAaxConversationTurn } from "@/lib/aether/aax-chat.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = supabaseAdmin as any;
const requestIdFor = (request: Request) => request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
const hashBody = (value: unknown) => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");

export const Route = createFileRoute("/api/v1/$")({ server: { handlers: {
  GET: (ctx) => handle(ctx), POST: (ctx) => handle(ctx), PUT: (ctx) => handle(ctx), PATCH: (ctx) => handle(ctx), DELETE: (ctx) => handle(ctx),
  OPTIONS: async () => new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Request-Id, Idempotency-Key", "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS" } }),
} } });

async function handle({ request }: { request: Request }) {
  const started = Date.now(); const requestId = requestIdFor(request); const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/v1\/?/, "").replace(/\/+$/, ""); const segments = path ? path.split("/").filter(Boolean).map(decodeURIComponent) : [];
  let identity: Awaited<ReturnType<typeof authenticateDeveloperApiKey>> = null; let status = 200;
  try {
    identity = await authenticateDeveloperApiKey(request);
    if (!identity) { status = 401; return withHeaders(apiError(401, "invalid_api_key", "A valid Aether API key is required"), requestId); }
    const security = await authorizeDeveloperRequest(identity.ownerId, request, path, requestId);
    const requiresApproval = Boolean(security.requires_approval ?? security.requiresApproval);
    if (!security.allowed) { status = requiresApproval ? 202 : 403; return withHeaders(apiError(status, requiresApproval ? "approval_required" : "security_denied", security.reason ?? "Developer API request was blocked by the security policy", { requestId: security.request_id ?? requestId }), requestId); }
    let body: any = {};
    if (["POST", "PUT", "PATCH"].includes(request.method)) {
      if (!(request.headers.get("content-type") ?? "").includes("application/json")) { status = 415; return withHeaders(apiError(415, "unsupported_media_type", "Requests with a body must use application/json"), requestId); }
      try { body = await request.json(); } catch { status = 400; return withHeaders(apiError(400, "invalid_json", "Request body must contain valid JSON"), requestId); }
    }
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null;
    if (idempotencyKey && !/^[A-Za-z0-9._:-]{8,255}$/.test(idempotencyKey)) { status = 400; return withHeaders(apiError(400, "invalid_idempotency_key", "Idempotency-Key must be 8-255 characters using letters, numbers, '.', '_', ':' or '-'"), requestId); }
    if (idempotencyKey) { const replay = await loadIdempotency(identity.apiKeyId, idempotencyKey, hashBody(body)); if (replay) { status = replay.statusCode; return withHeaders(new Response(JSON.stringify(replay.body), { status: replay.statusCode, headers: { "Content-Type": "application/json; charset=utf-8" } }), requestId); } }
    const response = await dispatchDeveloperRequest(request, identity, segments, body); status = response.status; const normalized = withHeaders(response, requestId);
    if (idempotencyKey && status >= 200 && status < 500) await saveIdempotency(identity.apiKeyId, identity.ownerId, idempotencyKey, hashBody(body), status, await normalized.clone().json().catch(() => ({})));
    return normalized;
  } catch (error) {
    if (error instanceof Response) { status = error.status; return withHeaders(error, requestId); }
    status = 500; return withHeaders(apiError(500, "internal_error", "Internal API error", { requestId }), requestId);
  } finally { if (identity) await logApiRequest(identity, request, `/api/v1/${path}`, status, started, { request_id: requestId, api_version: "v1", idempotency_key: request.headers.get("idempotency-key") ?? null }); }
}

function withHeaders(response: Response, requestId: string) { response.headers.set("Access-Control-Allow-Origin", "*"); response.headers.set("X-Request-Id", requestId); return response; }
async function loadIdempotency(apiKeyId: string, key: string, bodyHash: string) { const { data, error } = await db.from("aether_api_idempotency").select("request_hash,status_code,response_body,expires_at").eq("api_key_id", apiKeyId).eq("idempotency_key", key).maybeSingle(); if (error) throw new Error(`Idempotency lookup failed: ${error.message}`); if (!data) return null; if (new Date(data.expires_at).getTime() <= Date.now()) { await db.from("aether_api_idempotency").delete().eq("api_key_id", apiKeyId).eq("idempotency_key", key); return null; } if (data.request_hash !== bodyHash) throw apiError(409, "idempotency_conflict", "The Idempotency-Key was already used with a different request body"); return { statusCode: Number(data.status_code), body: data.response_body ?? {} }; }
async function saveIdempotency(apiKeyId: string, ownerId: string, key: string, bodyHash: string, statusCode: number, body: unknown) { const { error } = await db.from("aether_api_idempotency").insert({ api_key_id: apiKeyId, owner_id: ownerId, idempotency_key: key, request_hash: bodyHash, status_code: statusCode, response_body: body }); if (error && !String(error.message).toLowerCase().includes("duplicate")) throw new Error(`Idempotency persistence failed: ${error.message}`); }

async function dispatchDeveloperRequest(request: Request, identity: NonNullable<Awaited<ReturnType<typeof authenticateDeveloperApiKey>>>, segments: string[], body: any) {
  const [resource, id] = segments;
  if (resource === "models" && request.method === "GET") { requireScope(identity, "agents:read"); const { data, error } = await db.from("aax_models").select("id,model_key,display_name,generation,revision,description,capabilities,specializations,context_window,output_limit,release_status,available_at,disabled_at,config,created_at,updated_at").is("disabled_at", null).order("generation", { ascending: false }).order("display_name", { ascending: true }).limit(200); if (error) return apiError(500, "model_catalog_error", error.message); return Response.json({ data: data ?? [] }); }
  if (resource === "files" && request.method === "GET") { requireScope(identity, "projects:read"); const query = db.from("aether_project_files").select("id,project_id,filename,mime_type,size_bytes,sha256,extraction_status,metadata,created_at,updated_at").eq("owner_id", identity.ownerId).order("created_at", { ascending: false }).limit(200); const { data, error } = id ? await query.eq("id", id).maybeSingle() : await query; if (error) return apiError(500, "file_catalog_error", error.message); if (id && !data) return apiError(404, "not_found", "File not found"); return Response.json({ data: data ?? [] }); }
  if (resource === "usage" && request.method === "GET") { requireScope(identity, "logs:read"); const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); const { data, error } = await db.from("aether_api_logs").select("status_code,latency_ms,path,method,created_at").eq("owner_id", identity.ownerId).gte("created_at", since).limit(10000); if (error) return apiError(500, "usage_error", error.message); const rows = data ?? []; const byStatus: Record<string, number> = {}; const byPath: Record<string, number> = {}; let latency = 0; for (const row of rows) { const s = String(row.status_code); byStatus[s] = (byStatus[s] ?? 0) + 1; byPath[row.path] = (byPath[row.path] ?? 0) + 1; latency += Number(row.latency_ms ?? 0); } return Response.json({ data: { period: "30d", requests: rows.length, averageLatencyMs: rows.length ? Math.round(latency / rows.length) : 0, byStatus, byPath } }); }
  if (resource === "conversations" && request.method === "POST") { requireScope(identity, "conversations:write"); if (!body?.message || typeof body.message !== "string") return apiError(400, "invalid_request", "message is required"); const result = await executeAaxConversationTurn(db, { ...body, userId: identity.ownerId, signal: request.signal }); return Response.json({ data: result }, { status: 201 }); }
  return handleDeveloperApi(request, identity, segments, body);
}

async function authorizeDeveloperRequest(ownerId: string, request: Request, path: string, requestId: string) { const resource = path.split("/")[0] || "root"; const action = `api.${request.method.toLowerCase()}.${resource}`; const { data, error } = await db.rpc("security_authorize_action", { p_idempotency_key: `developer-api:${requestId}`, p_actor_id: ownerId, p_agent_key: "developer-api", p_action: action, p_resource_type: resource, p_resource_id: path, p_context: { api_version: "v1", method: request.method, request_id: requestId } }); if (error) throw new Error(`Security authorization failed: ${error.message}`); return data as { allowed: boolean; requiresApproval?: boolean; requires_approval?: boolean; decision: string; reason?: string; request_id?: string }; }
