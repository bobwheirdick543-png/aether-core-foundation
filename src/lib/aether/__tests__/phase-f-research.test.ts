import { describe, expect, it } from "vitest";
import { createResearchPlan, compareResearchSources } from "../research-planner";
import { isHttpUrl, normalizeUrl, sourceQualityScore } from "../research-engine";
import { ResearchAccessLimiter, classifyRetryableStatus, contentChangeState, retryBackoffMs, unmetSourceRequirements } from "../research-policy";

describe("Phase F native research contracts", () => {
  it("normalizes tracking parameters without changing the resource identity", () => {
    expect(normalizeUrl("https://Example.com/path/?utm_source=test&x=1#section")).toBe("https://example.com/path?x=1");
  });

  it("preserves meaningful query parameters while removing known trackers", () => {
    expect(normalizeUrl("https://example.com/a?ref=campaign&lang=en&gclid=abc&page=2")).toBe("https://example.com/a?lang=en&page=2");
  });

  it("rejects private or non-http retrieval targets", () => {
    expect(isHttpUrl("http://localhost:3000/test")).toBe(false);
    expect(isHttpUrl("http://127.0.0.1/test")).toBe(false);
    expect(isHttpUrl("http://192.168.1.10/test")).toBe(false);
    expect(isHttpUrl("http://172.16.0.1/test")).toBe(false);
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

  it("classifies only transient HTTP statuses as retryable", () => {
    expect(classifyRetryableStatus(429)).toBe(true);
    expect(classifyRetryableStatus(503)).toBe(true);
    expect(classifyRetryableStatus(404)).toBe(false);
    expect(classifyRetryableStatus(401)).toBe(false);
  });

  it("keeps retry backoff bounded and deterministic when jitter is supplied", () => {
    expect(retryBackoffMs(0, 0)).toBe(400);
    expect(retryBackoffMs(4, 1)).toBe(8000 + 2000);
    expect(retryBackoffMs(20, 1)).toBe(10000);
  });

  it("records new, unchanged, and changed content states", () => {
    expect(contentChangeState(null, "abc")).toBe("new");
    expect(contentChangeState("abc", "abc")).toBe("unchanged");
    expect(contentChangeState("abc", "def")).toBe("changed");
  });

  it("reports unmet source and domain diversity requirements explicitly", () => {
    expect(unmetSourceRequirements(2, 1, { minSources: 3, minDomains: 2 })).toEqual([
      "minimum sources not met: 2/3",
      "minimum domains not met: 1/2",
    ]);
    expect(unmetSourceRequirements(3, 2, { minSources: 3, minDomains: 2 })).toEqual([]);
  });

  it("bounds concurrent research work and applies per-domain pacing", () => {
    const limiter = new ResearchAccessLimiter({ maxConcurrent: 1, minDomainIntervalMs: 1000 });
    expect(limiter.start("https://example.com/a", 1000)).toEqual({ allowed: true, waitMs: 0 });
    expect(limiter.start("https://example.com/b", 1001)).toEqual({ allowed: false, waitMs: 999, reason: "global_concurrency" });
    limiter.finish();
    expect(limiter.start("https://example.com/b", 1001)).toEqual({ allowed: false, waitMs: 999, reason: "domain_rate_limit" });
    limiter.finish();
    expect(limiter.start("https://example.com/b", 2001)).toEqual({ allowed: true, waitMs: 0 });
  });
});
