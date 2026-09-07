/**
 * COGNITIVE ORCHESTRATOR — placeholder architecture (Phase 6).
 * Describes the pipeline a request will pass through. No intelligence here.
 */

export interface OrchestratorStage {
  key: string;
  label: string;
  description: string;
  implemented: boolean;
}

export const ORCHESTRATOR_PIPELINE: OrchestratorStage[] = [
  { key: "request", label: "User request", description: "Input captured from interface or API.", implemented: true },
  { key: "intent", label: "Intent", description: "Classify what the request is asking for.", implemented: false },
  { key: "permissions", label: "Permissions", description: "Check role, scopes and agent limits.", implemented: true },
  { key: "memory", label: "Memory", description: "Load user and project memory.", implemented: false },
  { key: "knowledge", label: "Knowledge retrieval", description: "Retrieve production knowledge / RAG.", implemented: false },
  { key: "model", label: "Model selection", description: "Route to a provider via the model router.", implemented: false },
  { key: "tools", label: "Tools / agents", description: "Invoke permitted tools and agents.", implemented: false },
  { key: "evaluation", label: "Evaluation", description: "Score and verify the candidate answer.", implemented: false },
  { key: "response", label: "Final response", description: "Return response or action.", implemented: false },
];

export const PLATFORM_LAYERS = [
  "Platform",
  "Core services",
  "Models",
  "Memory",
  "Knowledge",
  "Tools",
  "Agents",
  "Projects / Modules",
  "External applications",
];
