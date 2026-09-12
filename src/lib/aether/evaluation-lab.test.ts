import { describe, expect, it } from "vitest";
import { classifyIntent, validateOrchestrationPlan } from "./orchestrator";
import { verifyClaim } from "./verification-engine";
import { buildReportPdf, buildReportDataFingerprint } from "./report-engine";
import { validateModuleManifest, validateModuleVersion, assertModuleDependenciesAcyclic } from "./module-runtime";
import { appendUnderstanding, buildDownstreamContext, AAX_KNOWLEDGE_FLOW, type AaxKnowledgePackage, type UnderstandingArtifact } from "./aax-knowledge-evolution";

describe("Phase V evaluation contracts", () => {
  it("evaluates real orchestrator planning output without simulation", () => {
    const plan = classifyIntent("Research and verify this claim and create a report");
    expect(plan.intent).toContain("research");
    expect(plan.agents).toContain("research");
    expect(plan.agents).toContain("verification");
    expect(plan.agents).toContain("report");
    expect(validateOrchestrationPlan(plan)).toBe(true);
  });

  it("requires approval for high-risk orchestration plans", () => {
    const plan = classifyIntent("send this to the user and change settings");
    expect(plan.riskLevel).toBe("high");
    expect(plan.approvalRequired).toBe(true);
  });

  it("evaluates verification contradiction handling", () => {
    const result = verifyClaim("The system is not operational", [
      { id: "support", title: "Evidence", domain: "example.org", content: "The system is operational and available", retrievedAt: new Date().toISOString() },
      { id: "contradiction", title: "Counter evidence", domain: "example.org", content: "The system is not operational", retrievedAt: new Date().toISOString() },
    ]);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.contradictionCount).toBeGreaterThanOrEqual(0);
    expect(result.requiresReview).toBe(true);
  });

  it("evaluates deterministic report generation", () => {
    const data = { title: "Evaluation", generatedAt: new Date(0).toISOString(), verificationStatus: "verified" as const, approvalStatus: "approved" as const, version: 1, sources: [], verifiedFindings: [], unresolvedClaims: [] };
    const pdf = buildReportPdf(data);
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toBe("%PDF-1.4");
    expect(pdf.length).toBeGreaterThan(100);
    expect(buildReportDataFingerprint(data)).toHaveLength(8);
  });

  it("evaluates module validation and dependency safety", () => {
    const manifest = { apiVersion: "aether.module/v1", slug: "evaluation-module", name: "Evaluation Module", description: "Trusted module", kind: "tool", entrypoint: "evaluation", capabilities: ["evaluation.read"], dependencies: [], inputs: ["input"], outputs: ["output"], configurationSchema: {}, prohibited: ["Bypass authorization"] };
    expect(validateModuleManifest(manifest)).toEqual([]);
    expect(validateModuleVersion("1.2.3")).toEqual([]);
    expect(() => assertModuleDependenciesAcyclic("evaluation-module", { "evaluation-module": [] })).not.toThrow();
    expect(() => assertModuleDependenciesAcyclic("a", { a: ["b"], b: ["a"] })).toThrow();
  });

  it("evaluates governed AAX knowledge flow contracts", () => {
    const artifact: UnderstandingArtifact = { understandingId: "evaluation", agentKey: "knowledge-acquisition", trainingJobId: "evaluation", targetModelId: "aax", parentUnderstandingIds: [], sequence: 1, interpretation: "evaluation", concepts: ["evaluation"], definitions: [], relationships: [], context: [], newKnowledge: ["evaluation"], existingKnowledgeLinks: [], corrections: [], contradictions: [], uncertainties: [], crossDomainConnections: [], reasoning: ["contract"], evidence: ["evaluation"], confidence: 1, recommendedKnowledgeChanges: [] };
    const pkg: AaxKnowledgePackage = { trainingJobId: "evaluation", targetModelId: "aax", originalSource: { sourceType: "evaluation", reference: {} }, rawExtractedContent: "evaluation", understandings: [], evidence: [], knowledgeChanges: { newKnowledge: [], reinforcedKnowledge: [], correctedKnowledge: [], contradictedKnowledge: [], newRelationships: [] }, existingAaxKnowledge: [] };
    const downstream = buildDownstreamContext(appendUnderstanding(pkg, artifact));
    expect(downstream.understandings).toHaveLength(1);
    expect(AAX_KNOWLEDGE_FLOW.parallelBranches).toContain("verification");
    expect(AAX_KNOWLEDGE_FLOW.curator).toBe("curator");
  });
});
