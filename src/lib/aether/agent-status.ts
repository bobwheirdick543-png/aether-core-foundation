/** Shared agent operational-status helpers.
 *  Notification & Delivery Agent is bypassed when not enabled.
 */
import type { AgentKey } from "./agents";

export type AgentOperationalStatus = "enabled" | "disabled" | "maintenance";

/** Returns agent_key → status from the agents table. */
export async function loadAgentStatusMap(supabase: any): Promise<Map<string, AgentOperationalStatus>> {
  const { data, error } = await supabase.from("agents").select("agent_key, status");
  const map = new Map<string, AgentOperationalStatus>();
  if (error || !data) return map;
  for (const row of data as { agent_key: string; status: string }[]) {
    const status =
      row.status === "enabled" || row.status === "maintenance" || row.status === "disabled"
        ? (row.status as AgentOperationalStatus)
        : "disabled";
    map.set(row.agent_key, status);
  }
  return map;
}

/** True only when the agent is fully operational (enabled). */
export function isAgentEnabled(statusMap: Map<string, AgentOperationalStatus>, key: string): boolean {
  return statusMap.get(key) === "enabled";
}

/**
 * Filter a list of agent keys so that:
 * - disabled / unknown agents are removed
 * - notification is always skipped unless it is explicitly enabled
 *   (bypass Notification & Delivery until the administrator activates it)
 */
export function filterRunnableAgents(
  agents: AgentKey[],
  statusMap: Map<string, AgentOperationalStatus>,
): AgentKey[] {
  return agents.filter((key) => {
    if (key === "notification") {
      return isAgentEnabled(statusMap, "notification");
    }
    const status = statusMap.get(key);
    // If the agent is not in the DB yet, allow orchestrator/core paths; otherwise require enabled.
    if (status === undefined) return key === "orchestrator";
    return status === "enabled";
  });
}

/** Drop notification steps from a workflow when notification is not enabled. */
export function filterWorkflowSteps<T extends { agent_key: string }>(
  steps: T[],
  statusMap: Map<string, AgentOperationalStatus>,
): T[] {
  return steps.filter((step) => {
    if (step.agent_key === "notification") {
      return isAgentEnabled(statusMap, "notification");
    }
    return true;
  });
}
