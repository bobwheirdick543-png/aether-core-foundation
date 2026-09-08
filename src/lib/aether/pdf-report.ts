/**
 * AETHER REPORT / PDF AGENT FOUNDATION
 *
 * Structured contracts for professional, versioned, Aether-branded reports.
 * Actual PDF rendering can be plugged in later (e.g. via a worker).
 * All artifacts must be stored in Supabase Storage + database metadata.
 * Never rely on browser storage.
 */

export type ReportType =
  | "research"
  | "verification"
  | "knowledge_summary"
  | "optimization"
  | "security"
  | "general";

export type ReportApprovalState = "pending" | "approved" | "rejected" | "superseded";
export type ReportVerificationState = "pending" | "verified" | "partial" | "failed";

export interface ReportMetadata {
  id?: string;
  owner_id: string;
  project_id?: string | null;
  task_id?: string | null;
  run_id?: string | null;
  report_type: ReportType;
  title: string;
  topic?: string | null;
  version: number;
  storage_path?: string | null; // Supabase Storage path
  file_name?: string | null;
  source_count?: number;
  verification_status: ReportVerificationState;
  approval_status: ReportApprovalState;
  generated_at: string;
  generated_by_agent?: string | null;
  timezone?: string;
  page_count?: number | null;
  file_size_bytes?: number | null;
  metadata?: Record<string, unknown>;
}

/** Deterministic, human-readable filename */
export function buildReportFileName(opts: {
  type: ReportType;
  topic?: string;
  generatedAt: Date;
  runId?: string;
  version?: number;
}): string {
  const safeTopic = (opts.topic || "report")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "report";
  const date = opts.generatedAt.toISOString().slice(0, 10);
  const time = opts.generatedAt.toISOString().slice(11, 16).replace(":", "-");
  const runPart = opts.runId ? `_${opts.runId.slice(0, 8)}` : "";
  const ver = opts.version ?? 1;
  return `Aether_${capitalize(opts.type)}_${safeTopic}_${date}_${time}${runPart}_v${ver}.pdf`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Suggested Supabase Storage path (private bucket) */
export function buildStoragePath(ownerId: string, fileName: string): string {
  return `reports/${ownerId}/${fileName}`;
}

/** Sections every professional Aether report should contain */
export const REPORT_SECTIONS = [
  "cover",
  "executive_summary",
  "findings",
  "evidence",
  "sources",
  "verification_status",
  "unresolved_claims",
  "approval_state",
  "metadata",
  "footer",
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number];

export interface ReportContent {
  title: string;
  type: ReportType;
  generatedAt: string;
  timezone?: string;
  taskId?: string;
  runId?: string;
  projectId?: string;
  agentKey?: string;
  executiveSummary?: string;
  findings: Array<{ claim: string; evidence?: string; confidence?: number; status?: string }>;
  sources: Array<{ url?: string; title?: string; domain?: string; retrievedAt?: string }>;
  verificationStatus: ReportVerificationState;
  approvalStatus: ReportApprovalState;
  unresolvedClaims?: string[];
  version: number;
}
