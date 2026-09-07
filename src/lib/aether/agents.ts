/**
 * AETHER AGENT LAYER — architecture only (admin-facing).
 * Agents have no autonomous execution capability in this build.
 */

export type AgentKey = "research" | "verification" | "curator" | "report" | "module";
export type AgentStatus = "enabled" | "disabled" | "maintenance";

export interface AgentPermission {
  permission: string;
  label: string;
  allowed: boolean;
  requiresApproval?: boolean;
}

export interface AgentDefinition {
  key: AgentKey;
  name: string;
  description: string;
  purpose: string;
  status: AgentStatus;
  tools: string[];
  permissions: AgentPermission[];
  lastActivity: string;
  openTasks: number;
}

export const AGENTS: AgentDefinition[] = [
  {
    key: "research",
    name: "Research Agent",
    description: "Searches the web and gathers candidate information.",
    purpose: "Collect candidate material into the research sandbox.",
    status: "disabled",
    tools: ["web.search", "url.fetch", "sandbox.write"],
    lastActivity: "No activity yet",
    openTasks: 0,
    permissions: [
      { permission: "web.search", label: "Can search the web", allowed: true },
      { permission: "sources.read", label: "Can read sources", allowed: true },
      { permission: "research_sandbox.write", label: "Can write to research sandbox", allowed: true },
      { permission: "knowledge.publish", label: "Can publish production knowledge", allowed: false },
    ],
  },
  {
    key: "verification",
    name: "Verification Agent",
    description: "Checks claims, sources, dates, contradictions and evidence.",
    purpose: "Evaluate evidence and flag contradictions before approval.",
    status: "disabled",
    tools: ["research.read", "sources.compare"],
    lastActivity: "No activity yet",
    openTasks: 0,
    permissions: [
      { permission: "research.read", label: "Can read research", allowed: true },
      { permission: "evidence.evaluate", label: "Can evaluate evidence", allowed: true },
      { permission: "contradictions.flag", label: "Can flag contradictions", allowed: true },
      { permission: "knowledge.publish", label: "Can publish production knowledge", allowed: false },
    ],
  },
  {
    key: "curator",
    name: "Knowledge Curator",
    description: "Converts approved research into structured production knowledge.",
    purpose: "Publish knowledge, only after explicit human approval.",
    status: "disabled",
    tools: ["verified.read", "knowledge.write"],
    lastActivity: "No activity yet",
    openTasks: 0,
    permissions: [
      { permission: "knowledge.transform", label: "Can transform approved information", allowed: true },
      {
        permission: "knowledge.publish",
        label: "Can publish to production knowledge",
        allowed: true,
        requiresApproval: true,
      },
    ],
  },
  {
    key: "report",
    name: "Report Agent",
    description: "Organizes verified research into readable reports and PDFs.",
    purpose: "Produce readable reports from verified research.",
    status: "disabled",
    tools: ["verified.read", "pdf.generate"],
    lastActivity: "No activity yet",
    openTasks: 0,
    permissions: [
      { permission: "research.verified.read", label: "Can read verified research", allowed: true },
      { permission: "reports.generate", label: "Can generate reports", allowed: true },
      { permission: "knowledge.approve", label: "Can approve knowledge", allowed: false },
    ],
  },
  {
    key: "module",
    name: "Game / Module Agent",
    description: "Helps create and manage structured application and game modules.",
    purpose: "Assist with module definitions, rules, state and versioning.",
    status: "disabled",
    tools: ["modules.read", "modules.draft"],
    lastActivity: "No activity yet",
    openTasks: 0,
    permissions: [
      { permission: "modules.read", label: "Can read modules", allowed: true },
      { permission: "modules.draft.write", label: "Can write module drafts", allowed: true },
      { permission: "modules.execute", label: "Can execute modules autonomously", allowed: false },
    ],
  },
];
