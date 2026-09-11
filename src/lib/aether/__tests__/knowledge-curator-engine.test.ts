import { describe, expect, it } from "vitest";
import { canPublishCandidate, extractKnowledge, findConflicts, freshnessFromEvidence, mergeFreshness, normalizeKnowledgeText } from "../knowledge-curator-engine";

describe("Phase H knowledge curator engine", () => {
  it("normalizes and hashes extracted claims deterministically", async () => {
    const one = await extractKnowledge("Aether Platform is governed. Aether Platform keeps provenance.");
    const two = await extractKnowledge(" Aether Platform is governed.  Aether Platform keeps provenance. ");
    expect(one.normalizedContent).toBe(two.normalizedContent);
    expect(one.contentHash).toBe(two.contentHash);
    expect(one.claims.length).toBe(2);
    expect(one.claims[0].hash).toHaveLength(64);
  });

  it("extracts bounded entities and relations without treating them as verified facts", async () => {
    const result = await extractKnowledge("Aether Platform is governed by Supabase. The Aether Platform contains durable knowledge.");
    expect(result.entities.some((entity) => normalizeKnowledgeText(entity.name).includes("aether platform"))).toBe(true);
    expect(result.relations.length).toBeGreaterThan(0);
  });

  it("detects duplicate and overlapping candidate conflicts", async () => {
    const candidate = await extractKnowledge("Aether keeps provenance for trusted knowledge.");
    const duplicate = findConflicts({ normalizedContent: candidate.normalizedContent, claims: candidate.claims }, [{ id: "existing", normalizedContent: candidate.normalizedContent, claims: candidate.claims, status: "needs_review" }]);
    expect(duplicate[0]?.type).toBe("duplicate");
    const other = await extractKnowledge("Aether keeps provenance for trusted knowledge. Additional governance is applied.");
    const overlap = findConflicts({ normalizedContent: other.normalizedContent, claims: other.claims }, [{ id: "existing", normalizedContent: candidate.normalizedContent, claims: candidate.claims, status: "approved" }]);
    expect(overlap[0]?.type).toBe("conflict");
  });

  it("classifies freshness and gives stale/conflicted states precedence", () => {
    const now = new Date("2026-09-11T00:00:00Z");
    expect(freshnessFromEvidence({ publishedAt: "2026-09-01T00:00:00Z", now })).toBe("current");
    expect(freshnessFromEvidence({ publishedAt: "2026-06-01T00:00:00Z", now })).toBe("aging");
    expect(freshnessFromEvidence({ publishedAt: "2025-01-01T00:00:00Z", now })).toBe("stale");
    expect(mergeFreshness(["current", "stale"])).toBe("stale");
    expect(mergeFreshness(["current", "conflicted"])).toBe("conflicted");
  });

  it("blocks production publication until every governance gate passes", () => {
    expect(canPublishCandidate({ status: "needs_review", verificationStatus: "verified", conflicts: [], freshness: "current" }).ok).toBe(false);
    expect(canPublishCandidate({ status: "approved", verificationStatus: "pending", conflicts: [], freshness: "current" }).ok).toBe(false);
    expect(canPublishCandidate({ status: "approved", verificationStatus: "verified", conflicts: [{ type: "duplicate", reason: "x" }], freshness: "current" }).ok).toBe(false);
    expect(canPublishCandidate({ status: "approved", verificationStatus: "verified", conflicts: [], freshness: "stale" }).ok).toBe(false);
    expect(canPublishCandidate({ status: "approved", verificationStatus: "verified", conflicts: [], freshness: "current" })).toEqual({ ok: true });
  });
});
