import { describe, expect, it } from "vitest";
import { normalizeClaim, verifyClaim, verifyClaims } from "./verification-engine";

const base = {
  id: "source-1",
  url: "https://example.org/report",
  title: "Independent report",
  domain: "example.org",
  content: "The project launched in 2025 and serves 100 customers. The report was retrieved recently.",
  publishedAt: "2026-08-20T00:00:00Z",
  retrievedAt: "2026-09-11T00:00:00Z",
};

describe("Phase G verification engine", () => {
  it("normalizes claims deterministically", () => {
    expect(normalizeClaim("The Project launched in 2025!")).toBe(normalizeClaim("project launched 2025"));
  });

  it("verifies a claim only when multiple relevant sources agree", () => {
    const result = verifyClaim("The project launched in 2025", [
      base,
      { ...base, id: "source-2", domain: "example.edu", url: "https://example.edu/research", content: "A separate study confirms the project launched in 2025." },
    ], Date.parse("2026-09-11T00:00:00Z"));
    expect(result.verificationState).toBe("verified");
    expect(result.requiresReview).toBe(false);
    expect(result.evidence.length).toBe(2);
  });

  it("flags conflicting evidence", () => {
    const result = verifyClaim("The project launched in 2025", [
      base,
      { ...base, id: "source-2", content: "The project did not launch in 2025; the launch occurred in 2024." },
    ], Date.parse("2026-09-11T00:00:00Z"));
    expect(result.verificationState).toBe("conflicting");
    expect(result.contradictionCount).toBeGreaterThan(0);
    expect(result.requiresReview).toBe(true);
  });

  it("marks unsupported claims when no source is relevant", () => {
    const result = verifyClaim("The moon is made of cheese", [base]);
    expect(result.verificationState).toBe("unsupported");
    expect(result.missingEvidence).toBe(true);
    expect(result.uncertainty.length).toBeGreaterThan(0);
  });

  it("detects date mismatch and avoids automatic verification", () => {
    const result = verifyClaim("The project launched in 2026", [base], Date.parse("2026-09-11T00:00:00Z"));
    expect(result.dateMismatchCount).toBeGreaterThan(0);
    expect(result.verificationState).toBe("needs_review");
  });

  it("exposes uncertainty for stale evidence", () => {
    const result = verifyClaim("The project launched in 2025", [{ ...base, publishedAt: "2020-01-01T00:00:00Z", retrievedAt: "2020-01-02T00:00:00Z" }], Date.parse("2026-09-11T00:00:00Z"));
    expect(result.uncertainty.some((item) => item.toLowerCase().includes("old") || item.toLowerCase().includes("stale"))).toBe(true);
    expect(result.verificationState).toBe("outdated");
  });

  it("returns a structured result for every claim", () => {
    const results = verifyClaims(["The project launched in 2025", "The moon is made of cheese"], [base]);
    expect(results).toHaveLength(2);
    expect(results.map((item) => item.verificationState)).toEqual(["needs_review", "unsupported"]);
    for (const result of results) {
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.evidence)).toBe(true);
    }
  });
});
