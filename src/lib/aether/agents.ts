/**
 * AETHER AI TEAM — agent contracts.
 *
 * Internal platform workers, not user-facing bots. Phase H activates the
 * acquisition and curator agents inside the governed knowledge boundary.
 */

export type AgentKey =
  | "orchestrator"
  | "research"
  | "verification"
  | "knowledge-acquisition"
  | "curator"
  | "report"
  | "notification"
  | "security"
  | "optimization"
  | "module";

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
  mission: string;
  responsibilities: string[];
  prohibited: string[];
  status: AgentStatus;
  tools: string[];
  permissions: AgentPermission[];
  lastActivity: string;
  openTasks: number;
}

export const AGENTS: AgentDefinition[] = [
  {
    key: "orchestrator", name: "Orchestrator Agent", description: "Coordinates multi-agent workflows and routes work to the correct specialists.", purpose: "Decide which agents run, in what order, and under which constraints.", mission: "Coordinate platform work without performing domain work itself.", responsibilities: ["Route tasks", "Compose workflows", "Track run state", "Escalate failures"], prohibited: ["Publish knowledge", "Modify user roles", "Bypass approvals"], status: "disabled", tools: ["task.route", "workflow.compose", "run.track"], lastActivity: "No activity yet", openTasks: 0,
    permissions: [{ permission: "tasks.route", label: "Can route tasks", allowed: true }, { permission: "workflows.compose", label: "Can compose workflows", allowed: true }, { permission: "knowledge.publish", label: "Can publish production knowledge", allowed: false }, { permission: "roles.modify", label: "Can modify user roles", allowed: false }],
  },
  {
    key: "research", name: "Research Agent", description: "Searches the web and gathers candidate information into a research sandbox.", purpose: "Collect candidate material for later verification.", mission: "Discover and extract sources without publishing anything to production.", responsibilities: ["Web discovery", "Page retrieval", "Source extraction", "Sandbox writes"], prohibited: ["Production knowledge publishing", "User role changes", "System configuration"], status: "disabled", tools: ["web.search", "url.fetch", "sandbox.write"], lastActivity: "No activity yet", openTasks: 0,
    permissions: [{ permission: "web.search", label: "Can search the web", allowed: true }, { permission: "sources.read", label: "Can read sources", allowed: true }, { permission: "research_sandbox.write", label: "Can write to research sandbox", allowed: true }, { permission: "knowledge.publish", label: "Can publish production knowledge", allowed: false }],
  },
  {
    key: "verification", name: "Verification Agent", description: "Checks claims, sources, dates, contradictions and evidence quality.", purpose: "Evaluate evidence before anything becomes production knowledge.", mission: "Raise confidence and flag contradictions; never publish.", responsibilities: ["Evidence evaluation", "Contradiction detection", "Confidence scoring", "Human review routing"], prohibited: ["Production writes", "Credential access", "User permission changes", "Knowledge publication"], status: "enabled", tools: ["research.read", "sources.compare", "evidence.evaluate"], lastActivity: "Phase G activated", openTasks: 0,
    permissions: [{ permission: "research.read", label: "Can read research", allowed: true }, { permission: "evidence.evaluate", label: "Can evaluate evidence", allowed: true }, { permission: "contradictions.flag", label: "Can flag contradictions", allowed: true }, { permission: "knowledge.publish", label: "Can publish production knowledge", allowed: false }],
  },
  {
    key: "knowledge-acquisition", name: "Knowledge Acquisition Agent", description: "Ingests text and already-extracted documents, structures claims/entities/relations and prepares governed candidates.", purpose: "Turn trusted source material into structured candidates for curator review.", mission: "Extract, structure and compare — never silently publish.", responsibilities: ["Parse source text", "Extract claims", "Extract entities and relations", "Detect duplicates and conflicts", "Prepare provenance"], prohibited: ["Production publication", "Bypass curator approval", "Modify auth", "Self-escalate permissions"], status: "enabled", tools: ["source.parse", "claims.extract", "entities.extract", "relations.extract", "knowledge.compare", "candidate.write"], lastActivity: "Phase H activated", openTasks: 0,
    permissions: [{ permission: "sources.ingest", label: "Can ingest sources", allowed: true }, { permission: "candidates.write", label: "Can write candidate knowledge", allowed: true }, { permission: "knowledge.compare", label: "Can compare candidates", allowed: true }, { permission: "knowledge.publish", label: "Can publish production knowledge", allowed: false }],
  },
  {
    key: "curator", name: "Knowledge Curator", description: "Governs candidate knowledge, resolves review findings and publishes only explicitly approved, verified material.", purpose: "Control the boundary between candidate knowledge and production knowledge.", mission: "Review, approve, publish and version knowledge with complete provenance.", responsibilities: ["Review candidates", "Approve or reject", "Resolve conflicts", "Publish approved knowledge", "Create versions", "Rollback versions"], prohibited: ["Bypass verification", "Publish conflicted or stale candidates", "User account management", "System credentials", "Change own permissions"], status: "enabled", tools: ["verified.read", "knowledge.review", "knowledge.write", "knowledge.version", "knowledge.rollback"], lastActivity: "Phase H activated", openTasks: 0,
    permissions: [{ permission: "knowledge.transform", label: "Can transform approved information", allowed: true }, { permission: "knowledge.review", label: "Can review candidate knowledge", allowed: true }, { permission: "knowledge.publish", label: "Can publish to production knowledge", allowed: true, requiresApproval: true }, { permission: "knowledge.rollback", label: "Can create governed rollback versions", allowed: true, requiresApproval: true }],
  },
  {
    key: "report", name: "Report / PDF Agent", description: "Organizes verified research into readable, Aether-branded reports and PDFs.", purpose: "Produce durable report artifacts from verified work.", mission: "Generate structured PDFs with metadata, sources and versioning.", responsibilities: ["Report composition", "PDF generation", "Archive metadata"], prohibited: ["Self-approve high-impact reports", "Change permissions", "Modify auth"], status: "disabled", tools: ["verified.read", "pdf.generate", "archive.write"], lastActivity: "No activity yet", openTasks: 0,
    permissions: [{ permission: "research.verified.read", label: "Can read verified research", allowed: true }, { permission: "reports.generate", label: "Can generate reports", allowed: true }, { permission: "knowledge.approve", label: "Can approve knowledge", allowed: false }],
  },
  {
    key: "notification", name: "Notification & Delivery Agent", description: "Delivers in-app and email notifications with explicit ownership and action links.", purpose: "Notify the correct recipient about real events only.", mission: "Deliver accurate, authorized notifications — never cross users.", responsibilities: ["Create notifications", "Deliver channels", "Actionable links"], prohibited: ["Arbitrary user data access", "Change task ownership", "Modify knowledge"], status: "disabled", tools: ["notify.create", "notify.deliver"], lastActivity: "No activity yet", openTasks: 0,
    permissions: [{ permission: "notifications.create", label: "Can create notifications", allowed: true }, { permission: "notifications.deliver", label: "Can deliver notifications", allowed: true }, { permission: "knowledge.modify", label: "Can modify knowledge", allowed: false }, { permission: "roles.modify", label: "Can modify roles", allowed: false }],
  },
  {
    key: "security", name: "Security & Compliance Agent", description: "Monitors permission boundaries, policy violations and suspicious internal behaviour.", purpose: "Detect and flag violations; never be the only security layer.", mission: "Observe, flag and recommend — backend authorization remains authoritative.", responsibilities: ["Inspect telemetry", "Flag violations", "Recommend blocks"], prohibited: ["Delete audit history", "Change own permissions", "Unrestricted mutation"], status: "disabled", tools: ["security.inspect", "violations.flag"], lastActivity: "No activity yet", openTasks: 0,
    permissions: [{ permission: "security.inspect", label: "Can inspect security telemetry", allowed: true }, { permission: "violations.flag", label: "Can flag violations", allowed: true }, { permission: "audit.delete", label: "Can delete audit history", allowed: false }, { permission: "permissions.self_modify", label: "Can change own permissions", allowed: false }],
  },
  {
    key: "optimization", name: "Optimization Agent", description: "Analyses real performance telemetry and recommends configuration improvements.", purpose: "Identify bottlenecks and waste without silently changing production.", mission: "Recommend; administrator must approve controlled updates.", responsibilities: ["Latency analysis", "Failure patterns", "Resource recommendations"], prohibited: ["Silent production changes", "Silent permission changes", "Silent security policy changes"], status: "disabled", tools: ["telemetry.read", "recommendations.write"], lastActivity: "No activity yet", openTasks: 0,
    permissions: [{ permission: "telemetry.read", label: "Can read performance telemetry", allowed: true }, { permission: "recommendations.write", label: "Can write recommendations", allowed: true }, { permission: "config.auto_apply", label: "Can auto-apply config changes", allowed: false }],
  },
  {
    key: "module", name: "Module Agent", description: "Helps create and manage structured application and game modules in sandbox form.", purpose: "Draft and test modules without unrestricted server access.", mission: "Support module definitions, drafts and safe testing.", responsibilities: ["Module definitions", "Sandbox drafts", "Module testing"], prohibited: ["Arbitrary production code modification", "Credential access", "Unrestricted server access"], status: "disabled", tools: ["modules.read", "modules.draft"], lastActivity: "No activity yet", openTasks: 0,
    permissions: [{ permission: "modules.read", label: "Can read modules", allowed: true }, { permission: "modules.draft.write", label: "Can write module drafts", allowed: true }, { permission: "modules.execute", label: "Can execute modules autonomously", allowed: false }],
  },
];
