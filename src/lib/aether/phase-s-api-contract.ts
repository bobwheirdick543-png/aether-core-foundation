import { randomBytes } from "node:crypto";

export const PHASE_S_API_VERSION = "v1" as const;

export const PHASE_S_ERROR_CODES = {
  invalidRequest: "invalid_request",
  authenticationRequired: "authentication_required",
  insufficientScope: "insufficient_scope",
  notFound: "not_found",
  conflict: "conflict",
  rateLimited: "rate_limited",
  internal: "internal_error",
} as const;

export function requestIdFrom(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  if (supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)) return supplied;
  return `req_${randomBytes(12).toString("hex")}`;
}

export function jsonApi(body: unknown, status = 200, requestId?: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(requestId ? { "X-Request-Id": requestId } : {}),
      ...headers,
    },
  });
}

export function apiErrorResponse(status: number, code: string, message: string, requestId?: string, details?: unknown) {
  return jsonApi({ error: { code, message, ...(details === undefined ? {} : { details }) } }, status, requestId);
}

export function idempotencyKeyFrom(request: Request, body: unknown): string | null {
  const header = request.headers.get("idempotency-key")?.trim();
  const bodyKey = body && typeof body === "object" && "idempotencyKey" in body
    ? String((body as Record<string, unknown>).idempotencyKey ?? "").trim()
    : "";
  const value = header || bodyKey;
  if (!value) return null;
  return value.slice(0, 255);
}
