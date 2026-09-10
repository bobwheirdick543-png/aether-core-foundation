import type { AgentKey } from "./agents";

export const AAX_KNOWLEDGE_CHAIN: AgentKey[] = ["knowledge-acquisition", "research", "verification", "curator"];
export const AAX_KNOWLEDGE_PARALLEL_AUDIT: AgentKey[] = ["security"];
export const AAX_POST_TARGET_CHAIN: AgentKey[] = ["report", "notification"];
export const AAX_KNOWLEDGE_FLOW = { intake: "knowledge-acquisition" as AgentKey, parallelBranches: ["research", "verification", "security"] as AgentKey[], curator: "curator" as AgentKey, targetSelfAnalysis: "target-aax", postTarget: AAX_POST_TARGET_CHAIN } as const;

export interface UnderstandingArtifact { understandingId: string; agentKey: AgentKey; trainingJobId: string; targetModelId: string; sourceId?: string; parentUnderstandingIds: string[]; sequence: number; interpretation: string; concepts: string[]; definitions: string[]; relationships: string[]; context: string[]; newKnowledge: string[]; existingKnowledgeLinks: string[]; corrections: string[]; contradictions: string[]; uncertainties: string[]; crossDomainConnections: string[]; reasoning: string[]; evidence: string[]; confidence?: number; recommendedKnowledgeChanges: string[]; }
export interface AaxExistingKnowledge { id: string; content: unknown; state?: string | null; provenance?: unknown; confidence?: number | null; }
export interface AaxKnowledgePackage { trainingJobId: string; targetModelId: string; originalSource: { sourceType: string; sourceId?: string; sourceHash?: string; reference: Record<string, unknown> }; rawExtractedContent: string; understandings: UnderstandingArtifact[]; evidence: string[]; knowledgeChanges: { newKnowledge: string[]; reinforcedKnowledge: string[]; correctedKnowledge: string[]; contradictedKnowledge: string[]; newRelationships: string[] }; existingAaxKnowledge: AaxExistingKnowledge[]; }
export interface AaxSelfAnalysisResult { modelId: string; trainingJobId: string; sourceUnderstanding: string; acceptedKnowledgeChanges: string[]; rejectedOrDeferredChanges: string[]; specializationEffects: string[]; unresolvedQuestions: string[]; confidence?: number; }
export function appendUnderstanding(pkg: AaxKnowledgePackage, artifact: UnderstandingArtifact): AaxKnowledgePackage { return { ...pkg, understandings: [...pkg.understandings, artifact] }; }
export function buildDownstreamContext(pkg: AaxKnowledgePackage): AaxKnowledgePackage { return { ...pkg, understandings: [...pkg.understandings] }; }
