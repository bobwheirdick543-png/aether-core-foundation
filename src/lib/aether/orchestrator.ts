import type { AgentKey } from "./agents";
import type { AgentResult } from "./agent-sdk";
import type { TaskStatus } from "./task-runtime";

export interface OrchestratorStage { key: string; label: string; description: string; implemented: boolean; }

export const ORCHESTRATOR_PIPELINE: OrchestratorStage[] = [
  { key: "request", label: "User request", description: "Input captured from interface or API.", implemented: true },
  { key: "intent", label: "Intent", description: "Normalize the request into an actionable intent.", implemented: true },
  { key: "permissions", label: "Permissions", description: "Check requester, scopes and agent limits before execution.", implemented: true },
  { key: "context", label: "Context", description: "Assemble task-local context within an explicit budget.", implemented: true },
  { key: "knowledge", label: "Knowledge retrieval", description: "Approved production knowledge is consumed when the knowledge layer exposes it.", implemented: false },
  { key: "plan", label: "Typed plan", description: "Create traceable steps, dependencies, risk and expected outputs.", implemented: true },
  { key: "model", label: "Model routing", description: "Resolve the Aether capability/model role without coupling orchestration to a provider.", implemented: true },
  { key: "tools", label: "Tools / agents", description: "Delegate only through registered capabilities and the universal runtime.", implemented: true },
  { key: "evaluation", label: "Evaluation", description: "Evaluate intermediate results and escalate when required.", implemented: true },
  { key: "response", label: "Final response", description: "Produce a user-safe response from completed execution results.", implemented: true },
];

export const PLATFORM_LAYERS = ["Platform", "Core services", "Models", "Memory", "Knowledge", "Tools", "Agents", "Projects / Modules", "External applications"] as const;

export interface WorkflowStep {
  step_id: string;
  agent_key: AgentKey;
  description: string;
  depends_on?: string[];
  required_permission?: string;
  timeout_ms?: number;
  model_role?: ModelRole;
}

export interface WorkflowPlan { plan_id: string; task_id: string; steps: WorkflowStep[]; created_at: string; status: "planned" | "running" | "completed" | "failed" | "cancelled"; }

export interface OrchestratorDecision {
  next_agent: AgentKey | null;
  next_step_id?: string;
  action: "start_step" | "wait_approval" | "complete" | "fail" | "retry" | "escalate";
  reason: string;
  updated_status?: TaskStatus;
}

export type OrchestrationRisk = "low" | "medium" | "high" | "critical";
export type ModelRole = "aether-fast" | "aether-think" | "aether-code" | "aether-vision" | "aether-long" | "aether-translate";

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

export interface ContextBudget { totalTokens: number; systemTokens: number; historyTokens: number; knowledgeTokens: number; toolTokens: number; remainingTokens: number; }

const AGENT_KEYS = new Set<AgentKey>(["orchestrator", "research", "verification", "knowledge-acquisition", "curator", "report", "notification", "security", "optimization", "module"]);
const MODEL_ROLES: ModelRole[] = ["aether-fast", "aether-think", "aether-code", "aether-vision", "aether-long", "aether-translate"];
const text = (value: string, max: number) => String(value ?? "").trim().slice(0, max);

export function classifyIntent(message: string): OrchestrationPlanDraft {
  const raw = text(message, 8000); const lower = raw.toLowerCase();
  const capabilities = new Set<string>(); const agents = new Set<AgentKey>(["orchestrator"]); const tools = new Set<string>();
  let intent = "general_assistance"; let riskLevel: OrchestrationRisk = "low"; let expectedOutputs = ["response"];
  if (/research|investigate|find out|look up|source|latest|current/.test(lower)) { intent = "research"; capabilities.add("research"); capabilities.add("source_evidence"); agents.add("research"); agents.add("verification"); tools.add("web_research"); }
  if (/verify|fact.?check|validate|evidence|claim|contradict/.test(lower)) { intent = intent === "general_assistance" ? "verification" : `${intent}_and_verification`; capabilities.add("verification"); agents.add("verification"); }
  if (/report|pdf|document/.test(lower)) { intent = intent === "general_assistance" ? "report_generation" : `${intent}_and_report`; capabilities.add("report_generation"); agents.add("report"); expectedOutputs = ["structured_report"]; }
  if (/code|coding|program|debug|repository|repo/.test(lower)) capabilities.add("code");
  if (/image|photo|visual|screenshot/.test(lower)) capabilities.add("vision");
  if (/translate|translation/.test(lower)) capabilities.add("translation");
  if (/long form|long-form|deep analysis|very detailed/.test(lower)) capabilities.add("long_context");
  if (/delete|remove|change settings|admin|permission|credential|publish|send to/.test(lower)) riskLevel = "high";
  if (/delete account|drop database|give yourself admin|disable security/.test(lower)) riskLevel = "critical";
  return {
    title: raw.slice(0, 120) || "Aether request", intent, capabilities: [...capabilities], context: { requestText: raw },
    modelRequirements: { requiredCapabilities: [...capabilities], preferredRole: resolveModelRole([...capabilities]) },
    tools: [...tools], agents: [...agents], expectedOutputs, riskLevel, approvalRequired: riskLevel === "high" || riskLevel === "critical",
  };
}

export function validateOrchestrationPlan(plan: OrchestrationPlanDraft): true {
  if (!plan.intent) throw new Error("Orchestration intent is required");
  if (!plan.agents.length) throw new Error("Orchestration plan requires an agent");
  if (plan.agents.some((key) => !AGENT_KEYS.has(key))) throw new Error("Plan contains an unregistered agent");
  if (plan.riskLevel === "critical" && !plan.approvalRequired) throw new Error("Critical plans require approval");
  return true;
}

export function resolveModelRole(capabilities: string[], requested?: string): ModelRole {
  if (requested && MODEL_ROLES.includes(requested as ModelRole)) return requested as ModelRole;
  if (capabilities.includes("code")) return "aether-code";
  if (capabilities.includes("vision")) return "aether-vision";
  if (capabilities.includes("translation")) return "aether-translate";
  if (capabilities.includes("long_context")) return "aether-long";
  return capabilities.length > 1 ? "aether-think" : "aether-fast";
}

export function allocateContextBudget(totalTokens: number, input?: Partial<Omit<ContextBudget, "totalTokens" | "remainingTokens">>): ContextBudget {
  const total = Math.max(256, Math.floor(totalTokens));
  const requested = { systemTokens: Math.max(0, Math.floor(input?.systemTokens ?? Math.round(total * .12))), historyTokens: Math.max(0, Math.floor(input?.historyTokens ?? Math.round(total * .28))), knowledgeTokens: Math.max(0, Math.floor(input?.knowledgeTokens ?? Math.round(total * .28))), toolTokens: Math.max(0, Math.floor(input?.toolTokens ?? Math.round(total * .12))) };
  const used = requested.systemTokens + requested.historyTokens + requested.knowledgeTokens + requested.toolTokens;
  if (used > total) throw new Error(`Context budget exceeded: ${used} > ${total} tokens`);
  return { totalTokens: total, ...requested, remainingTokens: total - used };
}

export function buildWorkflowSteps(plan: OrchestrationPlanDraft, taskId: string): WorkflowPlan {
  const agents = [...plan.agents]; const steps: WorkflowStep[] = [];
  agents.forEach((agentKey, index) => {
    const previous = index > 0 ? [steps[index - 1].step_id] : [];
    const permission = agentKey === "research" ? "web.search" : agentKey === "report" ? "report.generate" : agentKey === "notification" ? "notification.send" : undefined;
    steps.push({ step_id: `${taskId}:step:${index + 1}`, agent_key: agentKey, description: agentKey === "orchestrator" ? "Coordinate and evaluate the request" : `Execute authorized ${agentKey} work`, depends_on: previous, required_permission: permission, timeout_ms: 60 * 60 * 1000, model_role: resolveModelRole(plan.capabilities) });
  });
  return { plan_id: `plan_${taskId}`, task_id: taskId, steps, created_at: new Date().toISOString(), status: "planned" };
}

export function planWorkflow(taskKind: string, taskId: string): WorkflowPlan {
  const baseSteps: Record<string, WorkflowStep[]> = {
    research: [{ step_id: "research", agent_key: "research", description: "Discover and extract sources" }, { step_id: "verify", agent_key: "verification", description: "Evaluate evidence", depends_on: ["research"] }, { step_id: "report", agent_key: "report", description: "Generate structured report/PDF", depends_on: ["verify"] }, { step_id: "notify", agent_key: "notification", description: "Notify owner", depends_on: ["report"] }],
    knowledge: [{ step_id: "acquire", agent_key: "knowledge-acquisition", description: "Extract candidate knowledge" }, { step_id: "verify", agent_key: "verification", description: "Verify candidates", depends_on: ["acquire"] }, { step_id: "review", agent_key: "orchestrator", description: "Wait for admin approval", depends_on: ["verify"] }, { step_id: "curate", agent_key: "curator", description: "Publish approved knowledge", depends_on: ["review"] }],
    report: [{ step_id: "report", agent_key: "report", description: "Generate report from verified material" }, { step_id: "notify", agent_key: "notification", description: "Notify owner", depends_on: ["report"] }],
  };
  return { plan_id: `plan_${taskId}`, task_id: taskId, steps: baseSteps[taskKind] ?? [{ step_id: "orchestrate", agent_key: "orchestrator", description: "Coordinate generic task" }], created_at: new Date().toISOString(), status: "planned" };
}

export function decideNext(plan: WorkflowPlan, completedStepIds: string[], lastResult?: AgentResult): OrchestratorDecision {
  if (lastResult?.requiresReview) return { next_agent: null, action: "wait_approval", reason: "Last step requires human review", updated_status: "waiting_approval" };
  if (lastResult && (lastResult.status === "failed" || (lastResult.errors && lastResult.errors.length > 0))) return { next_agent: null, action: "retry", reason: lastResult.errors?.[0] || "Step failed", updated_status: "retrying" };
  const remaining = plan.steps.filter((s) => !completedStepIds.includes(s.step_id));
  if (remaining.length === 0) return { next_agent: null, action: "complete", reason: "All steps completed", updated_status: "completed" };
  const next = remaining.find((s) => !s.depends_on || s.depends_on.every((d) => completedStepIds.includes(d)));
  if (!next) return { next_agent: null, action: "fail", reason: "No runnable step (dependency deadlock)", updated_status: "failed" };
  return { next_agent: next.agent_key, next_step_id: next.step_id, action: "start_step", reason: `Starting step: ${next.description}` };
}
