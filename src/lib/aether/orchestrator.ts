/**
 * AETHER COGNITIVE ORCHESTRATOR
 *
 * Coordinates work. Does not perform domain work itself.
 * Does not grant permissions. Does not bypass approvals.
 * Selects agents, sequences steps, monitors state, escalates.
 */

import type { AgentKey } from "./agents";
import type { AgentResult } from "./agent-sdk";
import type { TaskStatus } from "./task-runtime";

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

export interface WorkflowStep {
  step_id: string;
  agent_key: AgentKey;
  description: string;
  depends_on?: string[];
  required_permission?: string;
  timeout_ms?: number;
}

export interface WorkflowPlan {
  plan_id: string;
  task_id: string;
  steps: WorkflowStep[];
  created_at: string;
  status: "planned" | "running" | "completed" | "failed" | "cancelled";
}

export interface OrchestratorDecision {
  next_agent: AgentKey | null;
  next_step_id?: string;
  action: "start_step" | "wait_approval" | "complete" | "fail" | "retry" | "escalate";
  reason: string;
  updated_status?: TaskStatus;
}

/** Deterministic planner for common task kinds. Intelligence can replace later. */
export function planWorkflow(taskKind: string, taskId: string): WorkflowPlan {
  const baseSteps: Record<string, WorkflowStep[]> = {
    research: [
      { step_id: "research", agent_key: "research", description: "Discover and extract sources" },
      { step_id: "verify", agent_key: "verification", description: "Evaluate evidence", depends_on: ["research"] },
      { step_id: "report", agent_key: "report", description: "Generate structured report/PDF", depends_on: ["verify"] },
      { step_id: "notify", agent_key: "notification", description: "Notify owner", depends_on: ["report"] },
    ],
    knowledge: [
      { step_id: "acquire", agent_key: "knowledge-acquisition", description: "Extract candidate knowledge" },
      { step_id: "verify", agent_key: "verification", description: "Verify candidates", depends_on: ["acquire"] },
      { step_id: "review", agent_key: "orchestrator", description: "Wait for admin approval", depends_on: ["verify"] },
      { step_id: "curate", agent_key: "curator", description: "Publish approved knowledge", depends_on: ["review"] },
    ],
    report: [
      { step_id: "report", agent_key: "report", description: "Generate report from verified material" },
      { step_id: "notify", agent_key: "notification", description: "Notify owner", depends_on: ["report"] },
    ],
  };

  const steps = baseSteps[taskKind] ?? [
    { step_id: "orchestrate", agent_key: "orchestrator", description: "Coordinate generic task" },
  ];

  return {
    plan_id: `plan_${taskId}`,
    task_id: taskId,
    steps,
    created_at: new Date().toISOString(),
    status: "planned",
  };
}

/** Decide next action given current results. Pure function. */
export function decideNext(
  plan: WorkflowPlan,
  completedStepIds: string[],
  lastResult?: AgentResult,
): OrchestratorDecision {
  if (lastResult?.requiresReview) {
    return {
      next_agent: null,
      action: "wait_approval",
      reason: "Last step requires human review",
      updated_status: "waiting_approval",
    };
  }

  if (lastResult && (lastResult.status === "failed" || (lastResult.errors && lastResult.errors.length > 0))) {
    return {
      next_agent: null,
      action: "fail",
      reason: lastResult.errors?.[0] || "Step failed",
      updated_status: "failed",
    };
  }

  const remaining = plan.steps.filter((s) => !completedStepIds.includes(s.step_id));
  if (remaining.length === 0) {
    return {
      next_agent: null,
      action: "complete",
      reason: "All steps completed",
      updated_status: "completed",
    };
  }

  const next = remaining.find(
    (s) => !s.depends_on || s.depends_on.every((d) => completedStepIds.includes(d)),
  );

  if (!next) {
    return {
      next_agent: null,
      action: "fail",
      reason: "No runnable step (dependency deadlock)",
      updated_status: "failed",
    };
  }

  return {
    next_agent: next.agent_key,
    next_step_id: next.step_id,
    action: "start_step",
    reason: `Starting step: ${next.description}`,
  };
}
