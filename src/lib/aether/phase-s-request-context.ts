import { randomBytes } from "node:crypto";

export type PhaseSRequestContext = {
  requestId: string;
  idempotencyKey: string | null;
};

export function createPhaseSRequestContext(request: Request): PhaseSRequestContext {
  const supplied = request.headers.get("x-request-id")?.trim();
  const requestId = supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied)
    ? supplied
    : `req_${randomBytes(12).toString("hex")}`;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim().slice(0, 255) || null;
  return { requestId, idempotencyKey };
}

export function phaseSHeaders(context: PhaseSRequestContext): Record<string, string> {
  return { "X-Request-Id": context.requestId };
}
