import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeAaxChat, executeAaxChatStream } from "./aax-gateway";
import { executeAaxWebResearch } from "./aax-web-research";

export const Z2_API_VERSION = "z2" as const;
export const Z2_SECRET_LENGTH = 64;
export const Z2_FREE_MONTHLY_TOKENS = 200_000;
export const Z2_FREE_ACTIVE_KEY_LIMIT = 5;
export const Z2_DEFAULT_MAX_TOKENS_PER_REQUEST = 4096;
export const Z2_DEFAULT_MAX_INPUT_TOKENS = 12_000;
export const Z2_DEFAULT_MAX_OUTPUT_TOKENS = 4096;
export const Z2_ENVIRONMENTS = ["development", "test", "production"] as const;
export type Z2Environment = typeof Z2_ENVIRONMENTS[number];
export type Z2Identity = {
  apiKeyId: string;
  ownerId: string;
  projectId: string | null;
  scopes: string[];
  rateLimitPerMinute: number;
  apiKind: string;
  modelId: string;
  modelKey: string;
  modelGeneration: number;
  modelRevision: number;
  environment: Z2Environment;
  applicationName: string | null;
  status: string;
  monthlyTokenLimit: number;
  unlimitedTokens: boolean;
  maxTokensPerRequest: number;
  maxInputTokens: number;
  maxOutputTokens: number;
};

type KeyCreateInput = {
  ownerId: string;
  actorId: string;
  name: string;
  applicationName: string;
  environment: Z2Environment;
  modelKey: string;
  projectId?: string | null;
  expiresAt?: string | null;
  rateLimitPerMinute?: number;
  monthlyTokenLimit?: number;
  unlimitedTokens?: boolean;
  maxTokensPerRequest?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  permissions?: string[];
  allowWebResearch?: boolean;
  allowStreaming?: boolean;
  adminOverride?: boolean;
};

const db = supabaseAdmin as SupabaseClient;

function encryptionKey(): Buffer {
  const raw = process.env.AETHER_API_KEY_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("Missing server configuration: AETHER_API_KEY_ENCRYPTION_KEY");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const decoded = Buffer.from(raw, "base64url");
  if (decoded.length !== 32) throw new Error("AETHER_API_KEY_ENCRYPTION_KEY must encode exactly 32 bytes");
  return decoded;
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptSecret(value: string): string {
  const [version, ivText, tagText, ciphertextText] = value.split(".");
  if (version !== "1" || !ivText || !tagText || !ciphertextText) throw new Error("Invalid encrypted API key secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

export const hashZ2Secret = (secret: string) => createHash("sha256").update(secret).digest("hex");
export function makeZ2Secret(modelGeneration: number, modelRevision: number): string {
  const version = `${modelGeneration}.${modelRevision}`;
  const secret = randomBytes(48).toString("base64url");
  if (secret.length !== Z2_SECRET_LENGTH) throw new Error("Z2 secret generator produced an invalid length");
  return `AAX-${version}-${secret}`;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(`Administrator authorization check failed: ${error.message}`);
  return Boolean(data);
}

async function getAvailableModel(modelKey: string) {
  const { data, error } = await db.from("aax_models").select("id,model_key,display_name,generation,revision,description,capabilities,context_window,output_limit,release_status,available_at,disabled_at,provider,provider_model").eq("model_key", modelKey).eq("release_status", "available").is("disabled_at", null).or("available_at.is.null,available_at.lte." + new Date().toISOString()).maybeSingle();
  if (error) throw new Error(`Could not load AAX model: ${error.message}`);
  if (!data) throw new Response("Selected AAX model is not currently available", { status: 409 });
  return data;
}

async function recordKeyEvent(apiKeyId: string, ownerId: string, actorId: string | null, eventType: string, metadata: Record<string, unknown> = {}, actionSource = "user") {
  const { error } = await db.from("aether_api_key_events").insert({ api_key_id: apiKeyId, owner_id: ownerId, actor_id: actorId, event_type: eventType, action_source: actionSource, metadata });
  if (error) throw new Error(`API key audit event failed: ${error.message}`);
}

export async function createZ2ApiKey(input: KeyCreateInput) {
  const adminOverride = Boolean(input.adminOverride && await isAdmin(input.actorId));
  if (input.adminOverride && !adminOverride) throw new Response("Administrator authorization required", { status: 403 });
  const name = input.name.trim().slice(0, 120);
  const applicationName = input.applicationName.trim().slice(0, 160);
  if (!name) throw new Response("API key name is required", { status: 400 });
  if (!applicationName) throw new Response("Application name is required", { status: 400 });
  if (!Z2_ENVIRONMENTS.includes(input.environment)) throw new Response("Invalid API key environment", { status: 400 });
  const model = await getAvailableModel(input.modelKey.trim());
  if (input.projectId) {
    const { data } = await db.from("projects").select("id").eq("id", input.projectId).eq("owner_id", input.ownerId).eq("archived", false).maybeSingle();
    if (!data) throw new Response("Project not found or not owned by the current account", { status: 404 });
  }
  if (!adminOverride) {
    const { count, error } = await db.from("aether_api_keys").select("id", { count: "exact", head: true }).eq("owner_id", input.ownerId).eq("api_kind", "aax").eq("status", "active");
    if (error) throw new Error(`Could not determine API key limit: ${error.message}`);
    if ((count ?? 0) >= Z2_FREE_ACTIVE_KEY_LIMIT) throw new Response(`Free accounts may have up to ${Z2_FREE_ACTIVE_KEY_LIMIT} active Aether API keys`, { status: 409 });
  }
  const expiresAt = input.expiresAt ?? null;
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new Response("Expiration must be a valid future timestamp", { status: 400 });
  }
  const secret = makeZ2Secret(model.generation, model.revision);
  const keyHash = hashZ2Secret(secret);
  const encryptedSecret = encryptSecret(secret);
  const monthlyTokenLimit = adminOverride ? Math.max(0, Math.floor(input.monthlyTokenLimit ?? Z2_FREE_MONTHLY_TOKENS)) : Z2_FREE_MONTHLY_TOKENS;
  const unlimitedTokens = adminOverride ? Boolean(input.unlimitedTokens) : false;
  const maxTokensPerRequest = Math.min(100000, Math.max(1, Math.floor(input.maxTokensPerRequest ?? Z2_DEFAULT_MAX_TOKENS_PER_REQUEST)));
  const maxInputTokens = Math.min(1000000, Math.max(1, Math.floor(input.maxInputTokens ?? Z2_DEFAULT_MAX_INPUT_TOKENS)));
  const maxOutputTokens = Math.min(100000, Math.max(1, Math.floor(input.maxOutputTokens ?? Z2_DEFAULT_MAX_OUTPUT_TOKENS)));
  const permissions = Array.from(new Set((input.permissions ?? ["intelligence:invoke"]).map(String).filter(Boolean))).slice(0, 50);
  const { data, error } = await db.from("aether_api_keys").insert({
    owner_id: input.ownerId,
    project_id: input.projectId ?? null,
    name,
    key_prefix: secret.slice(0, Math.min(16, secret.length)),
    key_hash: keyHash,
    scopes: ["intelligence:invoke"],
    rate_limit_per_minute: Math.min(10000, Math.max(1, Math.floor(input.rateLimitPerMinute ?? 60))),
    expires_at: expiresAt,
    api_kind: "aax",
    model_id: model.id,
    model_key: model.model_key,
    model_generation: model.generation,
    model_revision: model.revision,
    environment: input.environment,
    application_name: applicationName,
    encrypted_secret: encryptedSecret,
    secret_recovery_available: true,
    status: "active",
    monthly_token_limit: monthlyTokenLimit,
    unlimited_tokens: unlimitedTokens,
    max_tokens_per_request: maxTokensPerRequest,
    max_input_tokens: maxInputTokens,
    max_output_tokens: maxOutputTokens,
    metadata: { permissions, allowWebResearch: Boolean(input.allowWebResearch), allowStreaming: input.allowStreaming !== false },
  }).select("id,owner_id,name,application_name,environment,key_prefix,model_id,model_key,model_generation,model_revision,rate_limit_per_minute,expires_at,status,monthly_token_limit,unlimited_tokens,max_tokens_per_request,max_input_tokens,max_output_tokens,secret_recovery_available,created_at,updated_at").single();
  if (error || !data) throw new Response(`Could not create Aether API key: ${error?.message ?? "unknown error"}`, { status: 500 });
  await recordKeyEvent(data.id, input.ownerId, input.actorId, "created", { modelKey: model.model_key, environment: input.environment, applicationName, monthlyTokenLimit, unlimitedTokens, permissions, allowWebResearch: Boolean(input.allowWebResearch), allowStreaming: input.allowStreaming !== false }, adminOverride ? "admin" : "user");
  return { ...data, key: secret, model: { id: model.id, key: model.model_key, displayName: model.display_name, generation: model.generation, revision: model.revision } };
}

export async function listZ2ApiKeys(ownerId: string, includeUsage = true) {
  const { data, error } = await db.from("aether_api_keys").select("id,owner_id,name,application_name,environment,key_prefix,project_id,model_id,model_key,model_generation,model_revision,rate_limit_per_minute,expires_at,revoked_at,last_used_at,created_at,updated_at,status,monthly_token_limit,unlimited_tokens,max_tokens_per_request,max_input_tokens,max_output_tokens,secret_recovery_available,metadata").eq("owner_id", ownerId).eq("api_kind", "aax").order("created_at", { ascending: false });
  if (error) throw new Response(error.message, { status: 500 });
  const keys = data ?? [];
  if (!includeUsage || !keys.length) return keys;
  const { data: usage } = await db.from("aether_api_key_usage_periods").select("api_key_id,period_start,token_limit,tokens_reserved,tokens_consumed,request_count").in("api_key_id", keys.map((key) => key.id)).eq("period_start", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const usageByKey = new Map((usage ?? []).map((row) => [row.api_key_id, row]));
  return keys.map((key) => ({ ...key, usage: usageByKey.get(key.id) ?? { token_limit: key.monthly_token_limit, tokens_reserved: 0, tokens_consumed: 0, request_count: 0 }, tokensRemaining: key.unlimited_tokens ? null : Math.max(0, Number(key.monthly_token_limit) - Number(usageByKey.get(key.id)?.tokens_consumed ?? 0) - Number(usageByKey.get(key.id)?.tokens_reserved ?? 0)) }));
}

export async function getZ2ApiKeySecret(ownerId: string, keyId: string, actorId = ownerId) {
  const { data: key, error } = await db.from("aether_api_keys").select("id,owner_id,name,key_prefix,encrypted_secret,secret_recovery_available,status,api_kind").eq("id", keyId).eq("owner_id", ownerId).eq("api_kind", "aax").maybeSingle();
  if (error || !key) throw new Response("API key not found", { status: 404 });
  if (!key.secret_recovery_available || !key.encrypted_secret) throw new Response("This legacy API key cannot be recovered. Rotate it to create a recoverable Z2 key.", { status: 409 });
  if (key.status === "revoked") throw new Response("Revoked API keys cannot be recovered", { status: 409 });
  const secret = decryptSecret(key.encrypted_secret);
  await recordKeyEvent(key.id, ownerId, actorId, "viewed", { purpose: "secret_recovery" });
  return { id: key.id, name: key.name, key: secret };
}

export async function revokeZ2ApiKey(ownerId: string, keyId: string, actorId = ownerId, admin = false) {
  let query = db.from("aether_api_keys").update({ revoked_at: new Date().toISOString(), status: "revoked", updated_at: new Date().toISOString() }).eq("id", keyId).eq("api_kind", "aax").is("revoked_at", null);
  if (!admin) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.select("id,owner_id").maybeSingle();
  if (error || !data) throw new Response("API key not found or already revoked", { status: 404 });
  await recordKeyEvent(data.id, data.owner_id, actorId, "revoked", { ownerId: data.owner_id }, admin ? "admin" : "user");
  return { ok: true };
}

export async function suspendZ2ApiKey(ownerId: string, keyId: string, actorId: string, suspend: boolean, admin = false) {
  let query = db.from("aether_api_keys").update({ status: suspend ? "suspended" : "active", updated_at: new Date().toISOString() }).eq("id", keyId).eq("api_kind", "aax").in("status", suspend ? ["active"] : ["suspended"]);
  if (!admin) query = query.eq("owner_id", ownerId);
  const { data, error } = await query.select("id,owner_id,status").maybeSingle();
  if (error || !data) throw new Response("API key not found or cannot change its current status", { status: 404 });
  await recordKeyEvent(data.id, data.owner_id, actorId, suspend ? "suspended" : "resumed", {}, admin ? "admin" : "user");
  return { ok: true, status: data.status };
}

export async function rotateZ2ApiKey(ownerId: string, keyId: string, actorId = ownerId, admin = false) {
  let query = db.from("aether_api_keys").select("id,owner_id,name,application_name,environment,project_id,model_key,expires_at,rate_limit_per_minute,monthly_token_limit,unlimited_tokens,max_tokens_per_request,max_input_tokens,max_output_tokens,metadata,status").eq("id", keyId).eq("api_kind", "aax");
  if (!admin) query = query.eq("owner_id", ownerId);
  const { data: old, error } = await query.maybeSingle();
  if (error || !old) throw new Response("API key not found", { status: 404 });
  if (old.status === "revoked") throw new Response("Revoked API keys cannot be rotated", { status: 409 });
  await revokeZ2ApiKey(old.owner_id, old.id, actorId, admin);
  return createZ2ApiKey({ ownerId: old.owner_id, actorId, name: old.name, applicationName: old.application_name ?? old.name, environment: old.environment, modelKey: old.model_key, projectId: old.project_id, expiresAt: old.expires_at, rateLimitPerMinute: old.rate_limit_per_minute, monthlyTokenLimit: old.monthly_token_limit, unlimitedTokens: old.unlimited_tokens, maxTokensPerRequest: old.max_tokens_per_request, maxInputTokens: old.max_input_tokens, maxOutputTokens: old.max_output_tokens, permissions: old.metadata?.permissions, allowWebResearch: Boolean(old.metadata?.allowWebResearch), allowStreaming: old.metadata?.allowStreaming !== false, adminOverride: admin });
}

export async function authenticateZ2ApiKey(request: Request): Promise<Z2Identity | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const presented = match[1].trim();
  if (!/^AAX-\d+\.\d+-[A-Za-z0-9_-]{64}$/.test(presented)) return null;
  const { data, error } = await db.rpc("aether_api_z2_authenticate", { p_key_hash: hashZ2Secret(presented) });
  if (error || !data?.length) return null;
  const row = data[0];
  const identity: Z2Identity = {
    apiKeyId: row.api_key_id, ownerId: row.owner_id, projectId: row.project_id, scopes: row.scopes ?? [], rateLimitPerMinute: Number(row.rate_limit_per_minute ?? 60), apiKind: row.api_kind, modelId: row.model_id, modelKey: row.model_key, modelGeneration: Number(row.model_generation), modelRevision: Number(row.model_revision), environment: row.environment, applicationName: row.application_name, status: row.status, monthlyTokenLimit: Number(row.monthly_token_limit ?? Z2_FREE_MONTHLY_TOKENS), unlimitedTokens: Boolean(row.unlimited_tokens), maxTokensPerRequest: Number(row.max_tokens_per_request ?? Z2_DEFAULT_MAX_TOKENS_PER_REQUEST), maxInputTokens: Number(row.max_input_tokens ?? Z2_DEFAULT_MAX_INPUT_TOKENS), maxOutputTokens: Number(row.max_output_tokens ?? Z2_DEFAULT_MAX_OUTPUT_TOKENS),
  };
  const { data: allowed, error: rateError } = await db.rpc("aether_api_rate_allowed", { p_api_key_id: identity.apiKeyId, p_limit: identity.rateLimitPerMinute });
  if (rateError) throw new Error(`API rate check failed: ${rateError.message}`);
  if (allowed === false) throw new Response(JSON.stringify({ error: { code: "rate_limit_exceeded", message: "Rate limit exceeded", details: { retryAfterSeconds: 60 } } }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } });
  if (!identity.modelKey || !identity.modelId) throw new Response(JSON.stringify({ error: { code: "model_access_unavailable", message: "This API key has no authorized AAX model" } }), { status: 403, headers: { "Content-Type": "application/json" } });
  return identity;
}

function estimateTokens(messages: Array<{ role: string; content: string }>): number {
  const chars = JSON.stringify(messages).length;
  return Math.max(1, Math.ceil(chars / 4));
}

async function insertRequestRecord(input: { requestId: string; identity: Z2Identity; body: unknown; startedAt: string }) {
  const { data, error } = await db.from("aether_api_request_records").insert({ request_id: input.requestId, api_key_id: input.identity.apiKeyId, owner_id: input.identity.ownerId, application_name: input.identity.applicationName, environment: input.identity.environment, api_kind: "aax", api_version: Z2_API_VERSION, model_id: input.identity.modelId, model_key: input.identity.modelKey, request_body: input.body, started_at: input.startedAt, metadata: { modelLocked: true } }).select("id").single();
  if (error || !data) throw new Error(`API request audit record failed: ${error?.message ?? "unknown error"}`);
  return data.id as string;
}

async function finalizeRequestRecord(id: string, patch: Record<string, unknown>) {
  const { error } = await db.from("aether_api_request_records").update({ ...patch, completed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`API request audit finalization failed: ${error.message}`);
}

async function finalizeQuota(reservationId: string | null, actualTokens: number, success: boolean) {
  if (!reservationId) return { consumed: 0, released: 0 };
  const { data, error } = await db.rpc("aether_api_quota_finalize", { p_reservation_id: reservationId, p_actual_tokens: Math.max(0, Math.floor(actualTokens)), p_success: success });
  if (error) throw new Error(`API quota finalization failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return { consumed: Number(row?.consumed_tokens ?? 0), released: Number(row?.released_tokens ?? 0) };
}

function validateResponse(content: string, format: unknown): { status: "valid" | "invalid"; error?: string } {
  if (!content.trim()) return { status: "invalid", error: "AAX returned an empty response" };
  if (format === "json") {
    try { JSON.parse(content); } catch { return { status: "invalid", error: "AAX response was not valid JSON" }; }
  }
  return { status: "valid" };
}

export async function executeZ2Intelligence(request: Request, identity: Z2Identity, body: any, requestId: string) {
  const startedAt = new Date().toISOString();
  const recordId = await insertRequestRecord({ requestId, identity, body, startedAt });
  let reservationId: string | null = null;
  try {
    if (!(await db.rpc("aether_api_controls_enabled")).data) throw new Response(JSON.stringify({ error: { code: "intelligence_api_disabled", message: "Aether Intelligence API is temporarily unavailable" } }), { status: 503, headers: { "Content-Type": "application/json" } });
    const messages = Array.isArray(body?.messages) ? body.messages.filter((m: any) => m && ["system","user","assistant"].includes(m.role) && typeof m.content === "string") : [];
    if (!messages.length) throw new Response(JSON.stringify({ error: { code: "invalid_request", message: "messages must contain at least one valid message" } }), { status: 400, headers: { "Content-Type": "application/json" } });
    if (messages.some((m: any) => m.content.length > 120000)) throw new Response(JSON.stringify({ error: { code: "request_too_large", message: "A message exceeds the allowed input size" } }), { status: 413, headers: { "Content-Type": "application/json" } });
    const estimatedInput = estimateTokens(messages);
    if (estimatedInput > identity.maxInputTokens) throw new Response(JSON.stringify({ error: { code: "input_token_limit_exceeded", message: "The request exceeds this API key's input token limit" } }), { status: 413, headers: { "Content-Type": "application/json" } });
    const requestedOutput = Math.min(identity.maxOutputTokens, identity.maxTokensPerRequest, Math.max(1, Math.floor(body?.maxOutputTokens ?? identity.maxOutputTokens)));
    const requestedReservation = Math.min(identity.maxTokensPerRequest, estimatedInput + requestedOutput);
    const quota = await db.rpc("aether_api_quota_reserve", { p_api_key_id: identity.apiKeyId, p_request_record_id: recordId, p_requested_tokens: requestedReservation });
    if (quota.error) throw new Error(`API quota reservation failed: ${quota.error.message}`);
    const quotaRow = Array.isArray(quota.data) ? quota.data[0] : quota.data;
    if (!quotaRow?.allowed) {
      await finalizeRequestRecord(recordId, { status_code: 429, outcome: "quota_exhausted", error_code: quotaRow?.reason ?? "quota_exhausted", error_message: "Aether API token allowance is exhausted for the current usage period", response_validation_status: "not_run", tokens_reserved: 0 });
      throw new Response(JSON.stringify({ error: { code: quotaRow?.reason ?? "monthly_token_quota_exhausted", message: "Your Aether API token allowance has been exhausted for the current usage period." } }), { status: 429, headers: { "Content-Type": "application/json" } });
    }
    reservationId = quotaRow.reservation_id ?? null;
    await db.from("aether_api_request_records").update({ tokens_reserved: requestedReservation }).eq("id", recordId);
    if (body?.model && body.model !== identity.modelKey) throw new Response(JSON.stringify({ error: { code: "model_locked", message: `This API key is locked to ${identity.modelKey}` } }), { status: 403, headers: { "Content-Type": "application/json" } });
    const useResearch = Boolean(body?.webResearch);
    const metadata = await db.from("aether_api_keys").select("metadata").eq("id", identity.apiKeyId).maybeSingle();
    const keyMetadata = metadata.data?.metadata ?? {};
    if (useResearch && keyMetadata.allowWebResearch === false) throw new Response(JSON.stringify({ error: { code: "capability_not_authorized", message: "Web research is not enabled for this API key" } }), { status: 403, headers: { "Content-Type": "application/json" } });
    const signal = request.signal;
    const telemetry = { userId: identity.ownerId, kind: useResearch ? "aax.z2.web_research" : "aax.z2.intelligence" };
    const result = useResearch ? await executeAaxWebResearch(db, { modelKey: identity.modelKey, messages, maxOutputTokens: requestedOutput, signal, telemetry }) : await executeAaxChat(db, { modelKey: identity.modelKey, messages, maxOutputTokens: requestedOutput, signal, telemetry });
    const validation = validateResponse(result.content, body?.responseFormat);
    if (validation.status !== "valid") {
      const quotaFinal = await finalizeQuota(reservationId, result.tokensIn + result.tokensOut, false);
      await finalizeRequestRecord(recordId, { status_code: 502, outcome: "response_validation_failed", error_code: "invalid_model_response", error_message: validation.error, response_validation_status: "invalid", tokens_in: result.tokensIn, tokens_out: result.tokensOut, tokens_total: quotaFinal.consumed, usage_source: "provider", provider: result.provider ?? null, provider_model: result.providerModel, latency_ms: result.latencyMs, response_text: result.content });
      throw new Response(JSON.stringify({ error: { code: "invalid_model_response", message: "Aether could not validate the model response" } }), { status: 502, headers: { "Content-Type": "application/json" } });
    }
    const actualTokens = result.tokensIn + result.tokensOut;
    const quotaFinal = await finalizeQuota(reservationId, actualTokens, true);
    const responseBody = { data: { id: requestId, model: result.modelKey, content: result.content, usage: { inputTokens: result.tokensIn, outputTokens: result.tokensOut, totalTokens: actualTokens }, ...(useResearch ? { sources: (result as any).sources ?? [] } : {}) } };
    await finalizeRequestRecord(recordId, { status_code: 200, outcome: "completed", response_validation_status: "valid", response_body: responseBody, response_text: result.content, provider: (result as any).provider ?? null, provider_model: result.providerModel, tokens_in: result.tokensIn, tokens_out: result.tokensOut, tokens_total: quotaFinal.consumed, usage_source: "provider", latency_ms: result.latencyMs, metadata: { requestId, webResearch: useResearch } });
    return { responseBody, status: 200, recordId, tokens: quotaFinal.consumed, latencyMs: result.latencyMs };
  } catch (error) {
    if (error instanceof Response) {
      await finalizeQuota(reservationId, 0, false).catch(() => undefined);
      if (error.status !== 429) await finalizeRequestRecord(recordId, { status_code: error.status, outcome: "rejected", error_code: `http_${error.status}`, error_message: `Request rejected with HTTP ${error.status}`, response_validation_status: "not_run" }).catch(() => undefined);
      throw error;
    }
    await finalizeQuota(reservationId, 0, false).catch(() => undefined);
    await finalizeRequestRecord(recordId, { status_code: 500, outcome: "failed", error_code: "internal_error", error_message: error instanceof Error ? error.message : String(error), response_validation_status: "not_run" }).catch(() => undefined);
    throw error;
  }
}

export async function listZ2RequestRecords(ownerId: string, keyId?: string | null) {
  let query = db.from("aether_api_request_records").select("id,request_id,api_key_id,application_name,environment,model_key,provider,provider_model,response_validation_status,status_code,outcome,error_code,tokens_reserved,tokens_in,tokens_out,tokens_total,latency_ms,started_at,completed_at,created_at,metadata").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(500);
  if (keyId) query = query.eq("api_key_id", keyId);
  const { data, error } = await query;
  if (error) throw new Response(error.message, { status: 500 });
  return data ?? [];
}

export async function getZ2RequestRecord(ownerId: string, recordId: string) {
  const { data, error } = await db.from("aether_api_request_records").select("*").eq("owner_id", ownerId).eq("id", recordId).maybeSingle();
  if (error || !data) throw new Response("API request record not found", { status: 404 });
  return data;
}

export async function getZ2UsageForecast(ownerId: string, keyId?: string | null) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let query = db.from("aether_api_request_records").select("api_key_id,tokens_total,status_code,created_at").eq("owner_id", ownerId).gte("created_at", since);
  if (keyId) query = query.eq("api_key_id", keyId);
  const { data, error } = await query;
  if (error) throw new Response(error.message, { status: 500 });
  const rows = data ?? [];
  const tokens = rows.reduce((sum, row) => sum + Number(row.tokens_total ?? 0), 0);
  const requests = rows.length;
  const dailyTokens = tokens / 7;
  const dailyRequests = requests / 7;
  return { period: "7d", requests, tokens, dailyTokens: Math.round(dailyTokens), dailyRequests: Math.round(dailyRequests * 100) / 100, projectedMonthlyTokens: Math.round(dailyTokens * 30), projectedMonthlyRequests: Math.round(dailyRequests * 30) };
}

export async function getZ2Models() {
  const { data, error } = await db.from("aax_models").select("id,model_key,display_name,generation,revision,description,capabilities,context_window,output_limit,release_status,available_at,disabled_at").eq("release_status", "available").is("disabled_at", null).or("available_at.is.null,available_at.lte." + new Date().toISOString()).order("generation", { ascending: false }).order("revision", { ascending: false });
  if (error) throw new Response(error.message, { status: 500 });
  return data ?? [];
}

export async function getZ2AdminApiKeys() {
  const { data, error } = await db.from("aether_api_keys").select("id,owner_id,name,application_name,environment,key_prefix,project_id,model_id,model_key,model_generation,model_revision,rate_limit_per_minute,expires_at,revoked_at,last_used_at,created_at,updated_at,status,monthly_token_limit,unlimited_tokens,max_tokens_per_request,max_input_tokens,max_output_tokens,secret_recovery_available,metadata").eq("api_kind", "aax").order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Response(error.message, { status: 500 });
  return data ?? [];
}

export async function setZ2ExternalIntelligenceEnabled(actorId: string, enabled: boolean) {
  if (!(await isAdmin(actorId))) throw new Response("Forbidden", { status: 403 });
  const { error } = await db.from("aether_api_controls").update({ external_intelligence_enabled: enabled, updated_by: actorId, updated_at: new Date().toISOString() }).eq("id", true);
  if (error) throw new Error(`Could not update Aether Intelligence API control: ${error.message}`);
  await db.from("audit_logs").insert({ actor_id: actorId, action: enabled ? "admin.z2_intelligence_enabled" : "admin.z2_intelligence_disabled", target_type: "aether_api", target_id: "z2", metadata: { enabled } });
  return { enabled };
}

export async function getZ2SecurityAlerts() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db.from("aether_api_logs").select("api_key_id,owner_id,status_code,path,created_at,metadata").gte("created_at", since).not("api_key_id", "is", null).order("created_at", { ascending: false }).limit(10000);
  if (error) throw new Response(error.message, { status: 500 });
  const grouped = new Map<string, { requests: number; failures: number; last: string | null }>();
  for (const row of data ?? []) {
    const key = String(row.api_key_id); const current = grouped.get(key) ?? { requests: 0, failures: 0, last: null }; current.requests += 1; if (Number(row.status_code) >= 400) current.failures += 1; current.last = current.last ?? row.created_at; grouped.set(key, current);
  }
  return Array.from(grouped.entries()).filter(([, value]) => value.requests >= 500 || (value.requests >= 20 && value.failures / value.requests >= 0.8)).map(([apiKeyId, value]) => ({ apiKeyId, severity: value.requests >= 500 ? "high" : "medium", reason: value.requests >= 500 ? "high request volume" : "high error ratio", ...value }));
}
