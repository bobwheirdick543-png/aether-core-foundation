/** Phase M — canonical agent registry, durable contract validation and DB synchronization. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENTS, type AgentDefinition, type AgentKey } from "./agents";
import type { FullAgentDefinition } from "./agent-sdk";

export const AGENT_KEYS: readonly AgentKey[] = AGENTS.map((agent) => agent.key);
export const AGENT_LIFECYCLE = ["draft", "validated", "tested", "active", "disabled", "maintenance", "rolled_back"] as const;
export type AgentLifecycleState = (typeof AGENT_LIFECYCLE)[number];
const REQUIRED = ["agent_id","version","name","description","mission","responsibilities","prohibited","allowed_inputs","expected_outputs","tools","permissions","timeout_policy","retry_policy","escalation_policy","schedule_configuration","telemetry_configuration"] as const;

export function getStaticAgent(key: AgentKey): AgentDefinition {
  const agent = AGENTS.find((item) => item.key === key);
  if (!agent) throw new Error(`Unknown agent: ${key}`);
  return agent;
}

export function validateAgentDefinition(value: unknown): { ok: true; definition: FullAgentDefinition } | { ok: false; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, message: "Agent definition must be an object" };
  const candidate = value as Record<string, unknown>;
  for (const key of REQUIRED) if (!(key in candidate)) return { ok: false, message: `Missing required agent contract field: ${key}` };
  if (typeof candidate.agent_id !== "string" || !/^agent_[a-z0-9-]+$/.test(candidate.agent_id)) return { ok: false, message: "agent_id must use agent_<key> format" };
  if (typeof candidate.version !== "string" || !candidate.version.trim()) return { ok: false, message: "version is required" };
  for (const key of ["responsibilities","prohibited","allowed_inputs","expected_outputs","tools","permissions"]) if (!Array.isArray(candidate[key])) return { ok: false, message: `${key} must be an array` };
  const prohibited = (candidate.prohibited as unknown[]).filter((x): x is string => typeof x === "string").map((x) => x.toLowerCase());
  if (!prohibited.some((x) => x.includes("bypass authorization"))) return { ok: false, message: "Agent must explicitly prohibit bypassing authorization" };
  const permissions = (candidate.permissions as unknown[]).filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object").map((x) => String(x.permission ?? "").toLowerCase());
  if (permissions.some((x) => x.includes("roles.modify") || x.includes("permissions.self_modify") || x.includes("self_escalate"))) return { ok: false, message: "Agent contracts cannot grant role or permission self-modification" };
  const timeout = candidate.timeout_policy && typeof candidate.timeout_policy === "object" ? (candidate.timeout_policy as Record<string, unknown>).timeoutMs : null;
  if (!Number.isFinite(Number(timeout)) || Number(timeout) <= 0 || Number(timeout) > 18_000_000) return { ok: false, message: "Agent timeout must be between 1ms and 5h" };
  return { ok: true, definition: candidate as unknown as FullAgentDefinition };
}

export function makeVersionHash(definition: unknown): string {
  const text = JSON.stringify(definition);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function mergeStaticContract(key: AgentKey, definition?: Partial<FullAgentDefinition>): FullAgentDefinition {
  const base = getStaticAgent(key);
  const policy = { timeoutMs: 300_000, maxRetries: 3, backoffMs: 5_000, escalateOnFailure: true, escalateTo: "admin" as const };
  return { ...base, agent_id: definition?.agent_id ?? `agent_${key}`, version: definition?.version ?? "1.0.0", allowed_inputs: definition?.allowed_inputs ?? ["task_context","previous_results"], expected_outputs: definition?.expected_outputs ?? ["result","status","requires_review"], quality_requirements: definition?.quality_requirements ?? ["structured output","source traceability where applicable","no silent production writes"], timeout_policy: definition?.timeout_policy ?? policy, retry_policy: definition?.retry_policy ?? policy, escalation_policy: definition?.escalation_policy ?? { ...policy, maxRetries: 2 }, schedule_configuration: definition?.schedule_configuration ?? { enabled: false }, telemetry_configuration: definition?.telemetry_configuration ?? { collectMetrics: true, collectTimeline: true, retainDays: 90 }, ...definition };
}

export async function syncAgentRegistry(admin: SupabaseClient): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const agent of AGENTS) {
    const { data: existing } = await admin.from("agents").select("id,status").eq("agent_key", agent.key).maybeSingle();
    let agentId = existing?.id as string | undefined;
    if (!agentId) {
      const { data: inserted, error } = await admin.from("agents").insert({ agent_key: agent.key, name: agent.name, description: agent.description, purpose: agent.purpose, status: agent.status, tools: agent.tools, last_activity_at: null }).select("id").single();
      if (error || !inserted) continue;
      agentId = inserted.id;
    } else {
      await admin.from("agents").update({ name: agent.name, description: agent.description, purpose: agent.purpose, tools: agent.tools }).eq("id", agentId);
    }
    for (const perm of agent.permissions) await admin.from("agent_permissions").upsert({ agent_id: agentId, permission: perm.permission, allowed: perm.allowed, requires_approval: Boolean(perm.requiresApproval) }, { onConflict: "agent_id,permission" });
    upserted += 1;
  }
  return { upserted };
}
