export const ORCHESTRATION_PHASE = "B" as const;

export const ORCHESTRATION_CAPABILITIES = [
  "general", "reasoning", "planning", "code", "vision", "translation", "research", "verification", "knowledge", "report", "notification", "module",
] as const;

export type OrchestrationCapability = typeof ORCHESTRATION_CAPABILITIES[number];

export interface OrchestrationPlanContract {
  intent: string;
  capabilities: OrchestrationCapability[];
  context: { requestText: string; conversationId?: string | null; projectId?: string | null };
  modelRequirements: { role?: string | null; minimumContextTokens?: number | null };
  tools: string[];
  agents: string[];
  expectedOutputs: string[];
  riskLevel: "low" | "medium" | "high";
  approvalRequired: boolean;
}

export interface OrchestrationProgressEvent {
  planId: string;
  taskId: string;
  runId?: string | null;
  stepId?: string | null;
  type: string;
  message: string;
  timestamp: string;
}
