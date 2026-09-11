/** Phase M: provider-independent, policy-governed agent runtime primitives. */
import { AGENTS, type AgentKey, type AgentDefinition } from "@/lib/aether/agents";
import { createFullAgentDefinition, type FullAgentDefinition, type AgentTaskContext, type AgentResult, type AgentMessage } from "@/lib/aether/agent-sdk";

export type AgentLifecycle = "draft" | "validated" | "tested" | "active" | "disabled" | "maintenance";

export interface AgentVersion extends FullAgentDefinition {
  lifecycle: AgentLifecycle;
  configurationHash: string;
}

export interface AgentRegistryEntry {
  key: AgentKey;
  definition: FullAgentDefinition;
  lifecycle: AgentLifecycle;
}

export interface AgentHandler {
  execute(context: AgentTaskContext): Promise<AgentResult>;
}

export function buildAgentVersion(base: AgentDefinition, overrides?: Partial<FullAgentDefinition>): AgentVersion {
  const definition = createFullAgentDefinition(base, overrides);
  return { ...definition, lifecycle: base.status === "enabled" ? "active" : base.status, configurationHash: stableConfigurationHash(definition) };
}

export function stableConfigurationHash(definition: FullAgentDefinition): string {
  const json = JSON.stringify(definition, Object.keys(definition).sort());
  let hash = 2166136261;
  for (let i = 0; i < json.length; i += 1) { hash ^= json.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function validateAgentDefinition(definition: FullAgentDefinition): string[] {
  const errors: string[] = [];
  if (!definition.agent_id || !/^agent_[a-z0-9-]+$/.test(definition.agent_id)) errors.push("Invalid agent_id");
  if (!/^\d+\.\d+\.\d+$/.test(definition.version)) errors.push("Version must use semver");
  if (!definition.allowed_inputs.length) errors.push("allowed_inputs must not be empty");
  if (!definition.expected_outputs.length) errors.push("expected_outputs must not be empty");
  if (!definition.quality_requirements.length) errors.push("quality_requirements must not be empty");
  for (const policy of [definition.timeout_policy, definition.retry_policy, definition.escalation_policy]) {
    if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs <= 0) errors.push("Policy timeoutMs must be positive");
    if (!Number.isInteger(policy.maxRetries) || policy.maxRetries < 0) errors.push("Policy maxRetries must be non-negative");
  }
  if (!Number.isInteger(definition.telemetry_configuration.retainDays) || definition.telemetry_configuration.retainDays < 1) errors.push("Telemetry retention must be positive");
  if (definition.schedule_configuration.type === "interval" && (!definition.schedule_configuration.intervalMinutes || definition.schedule_configuration.intervalMinutes < 1)) errors.push("Interval schedule requires positive intervalMinutes");
  if (definition.schedule_configuration.type === "recurring" && definition.schedule_configuration.cron && definition.schedule_configuration.cron.trim().split(/\s+/).length !== 5) errors.push("Recurring schedule cron must contain five fields");
  return [...new Set(errors)];
}

export function buildRegistry(): Map<AgentKey, AgentRegistryEntry> {
  const registry = new Map<AgentKey, AgentRegistryEntry>();
  for (const base of AGENTS) {
    const definition = createFullAgentDefinition(base);
    const errors = validateAgentDefinition(definition);
    if (errors.length) throw new Error(`Invalid agent ${base.key}: ${errors.join(", ")}`);
    registry.set(base.key, { key: base.key, definition, lifecycle: base.status });
  }
  return registry;
}

export function assertLifecycleTransition(from: AgentLifecycle, to: AgentLifecycle): void {
  const allowed: Record<AgentLifecycle, AgentLifecycle[]> = {
    draft: ["validated", "disabled"], validated: ["tested", "draft", "disabled"], tested: ["active", "draft", "disabled"], active: ["maintenance", "disabled"], disabled: ["draft", "validated"], maintenance: ["active", "disabled"],
  };
  if (!allowed[from].includes(to)) throw new Error(`Invalid agent lifecycle transition: ${from} -> ${to}`);
}

export function authorizeAgentExecution(entry: AgentRegistryEntry, permission: string): void {
  if (!["active"].includes(entry.lifecycle)) throw new Error(`Agent ${entry.key} is not active`);
  const grant = entry.definition.permissions.find((item) => item.permission === permission);
  if (!grant?.allowed) throw new Error(`Agent ${entry.key} is not permitted to use ${permission}`);
  if (permission === "roles.modify" || permission === "permissions.self_modify") throw new Error("Agent permission-boundary mutation is prohibited");
}

export function validateAgentMessage(message: AgentMessage): void {
  if (!message.runId || !message.taskId || !message.type) throw new Error("Agent message requires task/run/type");
  if (message.fromAgent === message.toAgent) throw new Error("Self-directed agent messages are not allowed");
}

export function registrySnapshot(): AgentRegistryEntry[] { return [...buildRegistry().values()]; }
