import { describe, expect, it } from "vitest";
import { createResearchPlan, compareResearchSources } from "../research-planner";
import { isHttpUrl, normalizeUrl, sourceQualityScore } from "../research-engine";

describe("Phase F native research contracts", () => {
  it("normalizes tracking parameters without changing the resource identity", () => {
    expect(normalizeUrl("https://Example.com/path/?utm_source=test&x=1#section")).toBe("https://example.com/path?x=1");
  });

  it("rejects private or non-http retrieval targets", () => {
    expect(isHttpUrl("http://localhost:3000/test")).toBe(false);
    expect(isHttpUrl("http://127.0.0.1/test")).toBe(false);
    expect(isHttpUrl("file:///tmp/a.txt")).toBe(false);
    expect(isHttpUrl("https://example.com")).toBe(true);
  });

  it("produces bounded, non-truth-guaranteeing source quality signals", () => {
    const quality = sourceQualityScore({ status: 200, text: "a".repeat(5000), title: "Example", canonicalUrl: "https://example.com", publishedAt: new Date().toISOString(), updatedAt: null, stale: false, error: undefined } as any);
    expect(quality.score).toBeGreaterThanOrEqual(0);
    expect(quality.score).toBeLessThanOrEqual(1);
    expect(quality.factors.retrieval).toBe(1);
  });

  it("creates explicit multi-source research plans", () => {
    const plan = createResearchPlan("quantum computing", "source_comparison");
    expect(plan.queries.length).toBeGreaterThan(2);
    expect(plan.sourceRequirements.minDomains).toBeGreaterThanOrEqual(3);
    expect(plan.comparisonRules.flagConflicts).toBe(true);
  });

  it("records comparison signals without declaring truth", () => {
    const comparison = compareResearchSources("topic", [
      { id: "a", url: "https://one.example/a", content: "shared evidence alpha", publishedAt: "2026-01-01" },
      { id: "b", url: "https://two.example/b", content: "shared evidence beta", publishedAt: "2026-02-01" },
    ]);
    expect(comparison.domains).toHaveLength(2);
    expect(comparison.sourceIds).toEqual(["a", "b"]);
    expect(comparison.dateMismatches.length).toBeGreaterThan(0);
  });
});
