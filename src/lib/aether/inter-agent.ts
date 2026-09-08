/**
 * AETHER INTER-AGENT COMMUNICATION
 *
 * Agents communicate only through structured messages.
 * No free-form chat. No shared mutable global state.
 * Messages are attached to a specific task/run context.
 */

import type { AgentKey } from "./agents";
import type { AgentResult, AgentMessage } from "./agent-sdk";

export function createAgentMessage(
  from: AgentKey,
  to: AgentKey,
  taskId: string,
  runId: string,
  type: string,
  payload: AgentResult | Record<string, unknown>,
): AgentMessage {
  return {
    fromAgent: from,
    toAgent: to,
    taskId,
    runId,
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
}

/** Validate that a message stays inside the same task context */
export function assertSameTaskContext(
  message: AgentMessage,
  expectedTaskId: string,
  expectedRunId: string,
): void {
  if (message.taskId !== expectedTaskId || message.runId !== expectedRunId) {
    throw new Error("Inter-agent message violated task/run context boundary");
  }
}
