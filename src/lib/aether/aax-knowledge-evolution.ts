import type { AgentKey } from "./agents";

/**
 * Canonical knowledge-evolution chain.
 * Orchestrator coordinates the workflow; it does not replace specialist analysis.
 * Every downstream understanding receives the original source and the full
 * accumulated understanding package. The target AAX performs its own final analysis.
 */
export const AAX_KNOWLEDGE_CHAIN: AgentKey[] = [
  "knowledge-acquisition",
  "research",
  "verification",
  "curator",
];

export const AAX_KNOWLEDGE_PARALLEL_AUDIT: AgentKey[] = ["security"];

export interface UnderstandingArtifact {
  understandingId: string;
  agentKey: AgentKey;
  trainingJobId: string;
  targetModelId: string;
  sourceId?: string;
  parentUnderstandingIds: string[];
  sequence: number;
  interpretation: string;
  concepts: string[];
  definitions: string[];
  relationships: string[];
  context: string[];
  newKnowledge: string[];
  existingKnowledgeLinks: string[];
  corrections: string[];
  contradictions: string[];
  uncertainties: string[];
  crossDomainConnections: string[];
  reasoning: string[];
  evidence: string[];
  confidence?: number;
  recommendedKnowledgeChanges: string[];
}

export interface AaxKnowledgePackage {
  trainingJobId: string;
  targetModelId: string;
  originalSource: {
    sourceType: string;
    sourceId?: string;
    sourceHash?: string;
    reference: Record<string, unknown>;
  };
  rawExtractedContent: string;
  understandings: UnderstandingArtifact[];
  evidence: string[];
  knowledgeChanges: {
    newKnowledge: string[];
    reinforcedKnowledge: string[];
    correctedKnowledge: string[];
    contradictedKnowledge: string[];
    newRelationships: string[];
  };
  existingAaxKnowledge: string[];
}

export interface AaxSelfAnalysisResult {
  modelId: string;
  trainingJobId: string;
  sourceUnderstanding: string;
  acceptedKnowledgeChanges: string[];
  rejectedOrDeferredChanges: string[];
  specializationEffects: string[];
  unresolvedQuestions: string[];
  confidence?: number;
}

export function appendUnderstanding(
  pkg: AaxKnowledgePackage,
  artifact: UnderstandingArtifact,
): AaxKnowledgePackage {
  return {
    ...pkg,
    understandings: [...pkg.understandings, artifact],
  };
}

export function buildDownstreamContext(pkg: AaxKnowledgePackage): AaxKnowledgePackage {
  // Preserve the original source and append-only collective understanding.
  return {
    ...pkg,
    understandings: [...pkg.understandings],
  };
}
