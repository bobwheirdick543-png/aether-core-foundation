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
  { key: "intent", label: "Intent", description: "Normalize the user's request into an actionable intent.", implemented: true },
  { key: "permissions", label: "Permissions", description: "Check role, scopes and agent limits before execution.", implemented: true },
  { key: "context", label: "Context", description: "Assemble only relevant task-local context within budget.", implemented: true },
  { key: "knowledge", label: "Knowledge retrieval", description: "Retrieve approved production knowledge when available.", implemented: false },
  { key: "plan", label: "Typed plan", description: "Create traceable steps, dependencies, risk and expected outputs.", implemented: true },
  { key: "model", label: "Model requirements", description: "Resolve the required Aether model capability without hard-coding a provider.", implemented: true },
  { key: "tools", label: "Tools / agents", description: "Invoke only permitted tools and agents through the universal runtime.", implemented: true },
  { key: "evaluation", label: "Evaluation", description: "Evaluate intermediate results and escalate when required.", implemented: false },
  { key: "response", label: "Final response", description: "Return a user-safe response or action result.", implemented: false },
];

export const PLATFORM_LAYERS = [
  "Platform", "Core services", "Models", "Memory", "Knowledge", "Tools", "Agents", "Projects / Modules", "External applications",
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

export type OrchestrationRisk = "low" | "medium" | "high" | "critical";

export interface OrchestrationPlanDraft {
  title: string;
  intent: string;
  capabilities: string[];
  context: Record<string, unknown>;
  modelRequirements: Record<string, unknown>;
  tools: string[];
  agents: AgentKey[];
  expectedOutputs: string[];
  riskLevel: OrchestrationRisk;
  approvalRequired: boolean;
}

const AGENT_KEYS = new Set<AgentKey>([
  "orchestrator", "research", "verification", "knowledge-acquisition", "curator",
  "report", "notification", "security", "optimization", "module",
]);

function text(value: string, max: number) { return String(value ?? "").trim().slice(0, max); }

/** Deterministic baseline classifier. A future model-backed classifier may improve semantics without changing policy boundaries. */
export function classifyIntent(message: string): OrchestrationPlanDraft {
  const raw = text(message, 8000);
  const lower = raw.toLowerCase();
  const capabilities = new Set<string>();
  const agents = new Set<AgentKey>(["orchestrator"]);
  const tools = new Set<string>();
  let intent = "general_assistance";
  let riskLevel: OrchestrationRisk = "low";
  let expectedOutputs = ["response"];

  if (/research|investigate|find out|look up|source|latest|current/.test(lower)) {
    intent = "research"; capabilities.add("research"); capabilities.add("source_evidence");
    agents.add("research"); agents.add("verification"); tools.add("web_research");
  }
  if (/verify|fact.?check|validate|evidence|claim|contradict/.test(lower)) {
    intent = intent === "general_assistance" ? "verification" : `${intent}_and_verification`;
    capabilities.add("verification"); agents.add("verification");
  }
  if (/report|pdf|document/.test(lower)) {
    intent = intent === "general_assistance" ? "report_generation" : `${intent}_and_report`;
    capabilities.add("report_generation"); agents.add("report"); expectedOutputs = ["structured_report"];
  }
  if (/code|coding|program|debug|repository|repo/.test(lower)) capabilities.add("code");
  if (/image|photo|visual|screenshot/.test(lower)) capabilities.add("vision");
  if (/translate|translation/.test(lower)) capabilities.add("translation");
  if (/delete|remove|change settings|admin|permission|credential|publish|send to/.test(lower)) riskLevel = "high";
  if (/delete account|drop database|give yourself admin|disable security/.test(lower)) riskLevel = "critical";

  return {
    title: raw.slice(0, 120) || "Aether request",
    intent,
    capabilities: [...capabilities],
    context: { requestText: raw },
    modelRequirements: {
      requiredCapabilities: [...capabilities],
      preferredRole: capabilities.has("code") ? "aether-code" : capabilities.has("vision") ? "aether-vision" : capabilities.has("translation") ? "aether-translate" : capabilities.size > 1 ? "aether-think" : "aether-fast",
    },
    tools: [...tools],
    agents: [...agents],
    expectedOutputs,
    riskLevel,
    approvalRequired: riskLevel === "high" || riskLevel === "critical",
  };
}

export function validateOrchestrationPlan(plan: OrchestrationPlanDraft): void {
  if (!plan.intent) throw new Error("Orchestration intent is required");
  if (plan.agents.some((key) => !AGENT_KEYS.has(key))) throw new Error("Plan contains an unregistered agent");
  if (plan.riskLevel === "critical" && !plan.approvalRequired) throw new Error("Critical plans require approval");
}

/** Existing deterministic task-kind planner retained for compatibility with Phase A execution paths. */
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
  return { plan_id: `plan_${taskId}`, task_id: taskId, steps: baseSteps[taskKind] ?? [{ step_id: "orchestrate", agent_key: "orchestrator", description: "Coordinate generic task" }], created_at: new Date().toISOString(), status: "planned" };
}

export function decideNext(plan: WorkflowPlan, completedStepIds: string[], lastResult?: AgentResult): OrchestratorDecision {
  if (lastResult?.requiresReview) return { next_agent: null, action: "wait_approval", reason: "Last step requires human review", updated_status: "waiting_approval" };
  if (lastResult && (lastResult.status === "failed" || (lastResult.errors && lastResult.errors.length > 0))) return { next_agent: null, action: "fail", reason: lastResult.errors?.[0] || "Step failed", updated_status: "failed" };
  const remaining = plan.steps.filter((s) => !completedStepIds.includes(s.step_id));
  if (remaining.length === 0) return { next_agent: null, action: "complete", reason: "All steps completed", updated_status: "completed" };
  const next = remaining.find((s) => !s.depends_on || s.depends_on.every((d) => completedStepIds.includes(d)));
  if (!next) return { next_agent: null, action: "fail", reason: "No runnable step (dependency deadlock)", updated_status: "failed" };
  return { next_agent: next.agent_key, next_step_id: next.step_id, action: "start_step", reason: `Starting step: ${next.description}` };
}
