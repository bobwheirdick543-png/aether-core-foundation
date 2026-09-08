/**
 * AETHER KNOWLEDGE PIPELINE
 *
 * SOURCE → Knowledge Acquisition → Candidate → Verification →
 * Admin Review → Knowledge Curator → Versioned Production Knowledge
 *
 * Default: mandatory administrator approval for production writes.
 * Never silently overwrite or publish.
 */

export type KnowledgeStage = "sandbox" | "verified" | "approved" | "production";

export interface KnowledgeCandidate {
  id?: string;
  collection_id?: string;
  owner_id: string;
  project_id?: string | null;
  title: string;
  body?: string;
  stage: KnowledgeStage;
  confidence: number;
  tags?: string[];
  sources?: Array<{ url?: string; title?: string; retrievedAt?: string }>;
  claims?: Array<{ text: string; evidence?: string; confidence?: number }>;
  conflicts?: string[];
  is_new?: boolean;
  is_duplicate?: boolean;
  is_outdated?: boolean;
  is_uncertain?: boolean;
  proposed_action?: "add" | "update" | "reject" | "review";
  created_at?: string;
}

export interface KnowledgeVersionRecord {
  entry_id: string;
  version: number;
  body?: string;
  stage: KnowledgeStage;
  change_note?: string;
  approved_by?: string | null;
  source_run_id?: string | null;
  created_at: string;
}

export interface AcquisitionResult {
  source_type: "text" | "pdf" | "url" | "document" | "image" | "research";
  candidates: KnowledgeCandidate[];
  summary: {
    total_found: number;
    new_count: number;
    existing_count: number;
    conflict_count: number;
    uncertain_count: number;
    proposed_add: number;
    proposed_update: number;
    proposed_reject: number;
  };
  requires_review: boolean;
}

/**
 * Curator may only publish when stage === "approved".
 * This is a pure guard — callers must still enforce via RLS + server functions.
 */
export function canCuratorPublish(stage: KnowledgeStage, hasExplicitApproval: boolean): boolean {
  return stage === "approved" && hasExplicitApproval;
}

export function nextVersionNumber(current: number | null | undefined): number {
  return (current ?? 0) + 1;
}

export function buildChangeNote(
  action: "add" | "update" | "reject",
  reason?: string,
): string {
  const base = action === "add" ? "Added from approved candidate" : action === "update" ? "Updated from approved candidate" : "Rejected";
  return reason ? `${base}: ${reason}` : base;
}
