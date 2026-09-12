import { recordObservabilityEvent, type ObservabilityContext } from "./observability";

export type SecurityAction = string;
export type SecurityResourceType =
  | "platform" | "user" | "project" | "conversation" | "task" | "run"
  | "agent" | "tool" | "module" | "model" | "knowledge" | "memory"
  | "report" | "notification" | "schedule" | "api_key" | "webhook" | "worker"
  | "safety_bin";

export interface SecurityActor { userId: string; roles?: readonly string[]; source?: "session" | "developer_api" | "worker" | "internal"; }
export interface SecurityBoundaryRequest {
  actor: SecurityActor; action: SecurityAction; resourceType: SecurityResourceType; resourceId?: string | null;
  ownerId?: string | null; projectOwnerId?: string | null; capabilities?: readonly string[];
  requiredCapability?: string | null; observability?: ObservabilityContext;
}
export class SecurityDeniedError extends Error { readonly code = "security_denied"; readonly status = 403; constructor(message: string) { super(message); this.name = "SecurityDeniedError"; } }
const PRIVILEGED_ROLES = new Set(["admin"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isPrivilegedActor(actor: SecurityActor): boolean { return Boolean(actor.roles?.some((role) => PRIVILEGED_ROLES.has(role))); }
export function assertAuthenticatedActor(actor: SecurityActor): void { if (!actor.userId || !UUID_RE.test(actor.userId)) throw new SecurityDeniedError("A valid authenticated actor is required"); }
export function assertOwner(actor: SecurityActor, ownerId: string | null | undefined): void { assertAuthenticatedActor(actor); if (!ownerId || ownerId !== actor.userId) throw new SecurityDeniedError("The actor does not own this resource"); }
export function assertCapability(actor: SecurityActor, capabilities: readonly string[] | undefined, required: string | null | undefined): void { if (!required || isPrivilegedActor(actor)) return; if (!capabilities?.includes(required)) throw new SecurityDeniedError(`Capability ${required} is required`); }
export function assertNoPrivilegeEscalation(actor: SecurityActor, requestedRoles?: readonly string[]): void { if (requestedRoles?.length && !isPrivilegedActor(actor)) throw new SecurityDeniedError("Privilege changes require an administrator"); }
export async function authorizeSecurityBoundary(input: SecurityBoundaryRequest): Promise<void> {
  try {
    assertAuthenticatedActor(input.actor); if (input.ownerId !== undefined) assertOwner(input.actor, input.ownerId); if (input.projectOwnerId !== undefined) assertOwner(input.actor, input.projectOwnerId);
    assertCapability(input.actor, input.capabilities, input.requiredCapability); if (input.action.startsWith("admin.") && !isPrivilegedActor(input.actor)) throw new SecurityDeniedError("Administrator privileges are required");
  } catch (error) {
    await recordObservabilityEvent({ context: input.observability ?? { traceId: crypto.randomUUID() }, level: "warn", component: "security", eventType: "authorization.denied", message: error instanceof Error ? error.message : "Authorization denied", success: false, retryable: false, errorCode: error instanceof SecurityDeniedError ? error.code : "authorization_error", metadata: { actor_source: input.actor.source ?? "session", action: input.action.slice(0, 160), resource_type: input.resourceType, resource_id: input.resourceId ?? null } });
    throw error;
  }
}
export function secureErrorResponse(error: unknown, requestId?: string): Response { if (error instanceof SecurityDeniedError) return Response.json({ error: { code: error.code, message: error.message, requestId } }, { status: error.status }); return Response.json({ error: { code: "security_error", message: "Security policy evaluation failed", requestId } }, { status: 500 }); }
export function assertRequestSize(request: Request, maxBytes = 2 * 1024 * 1024): void { const raw = request.headers.get("content-length"); if (!raw) return; const length = Number(raw); if (!Number.isFinite(length) || length < 0 || length > maxBytes) throw new SecurityDeniedError("Request exceeds the permitted payload size"); }
