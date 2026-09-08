/**
 * AETHER REPORT CONTENT BUILDER
 *
 * Builds a fully structured report object that can later be rendered to PDF.
 * No fabricated findings. Only uses real inputs supplied by the caller.
 */

import {
  type ReportContent,
  type ReportType,
  type ReportVerificationState,
  type ReportApprovalState,
  buildReportFileName,
  buildStoragePath,
} from "./pdf-report";

export interface BuildReportInput {
  ownerId: string;
  title: string;
  type?: ReportType;
  topic?: string;
  taskId?: string;
  runId?: string;
  projectId?: string;
  agentKey?: string;
  executiveSummary?: string;
  findings?: Array<{ claim: string; evidence?: string; confidence?: number; status?: string }>;
  sources?: Array<{ url?: string; title?: string; domain?: string; retrievedAt?: string }>;
  verificationStatus?: ReportVerificationState;
  approvalStatus?: ReportApprovalState;
  unresolvedClaims?: string[];
  version?: number;
  timezone?: string;
}

export function buildReportContent(input: BuildReportInput): {
  content: ReportContent;
  fileName: string;
  storagePath: string;
} {
  const generatedAt = new Date();
  const version = input.version ?? 1;

  const content: ReportContent = {
    title: input.title,
    type: input.type ?? "research",
    generatedAt: generatedAt.toISOString(),
    timezone: input.timezone ?? "UTC",
    taskId: input.taskId,
    runId: input.runId,
    projectId: input.projectId,
    agentKey: input.agentKey,
    executiveSummary: input.executiveSummary,
    findings: input.findings ?? [],
    sources: input.sources ?? [],
    verificationStatus: input.verificationStatus ?? "pending",
    approvalStatus: input.approvalStatus ?? "pending",
    unresolvedClaims: input.unresolvedClaims ?? [],
    version,
  };

  const fileName = buildReportFileName({
    type: content.type,
    topic: input.topic || input.title,
    generatedAt,
    runId: input.runId,
    version,
  });

  const storagePath = buildStoragePath(input.ownerId, fileName);

  return { content, fileName, storagePath };
}
