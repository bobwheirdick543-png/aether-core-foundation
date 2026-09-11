import { describe, expect, it } from "vitest";
import { AETHER_MEMORY_RELEVANCE_THRESHOLD, AETHER_SHORT_TERM_CHAR_BUDGET, AETHER_SHORT_TERM_MESSAGE_LIMIT, buildBoundedShortTermContext, classifyAetherMemoryContent, detectAetherMemoryContradiction, evaluateAetherMemoryRelevance, evaluateAetherMemoryStaleness } from "./aether-memory-governance";

describe("Phase E memory governance", () => {
  it("enforces a bounded short-term context by message count and characters", () => {
    const messages = Array.from({ length: 60 }, (_, index) => ({ role: "user", content: `${index} ${"x".repeat(4000)}` }));
    const result = buildBoundedShortTermContext(messages);
    expect(result.length).toBeLessThanOrEqual(AETHER_SHORT_TERM_MESSAGE_LIMIT);
    expect(result.reduce((sum, message) => sum + message.content.length, 0)).toBeLessThanOrEqual(AETHER_SHORT_TERM_CHAR_BUDGET);
    expect(result.at(-1)?.content).toContain("59");
  });

  it("scores relevant memories above the configured relevance threshold", () => {
    const score = evaluateAetherMemoryRelevance({ content: "User prefers concise technical answers about TypeScript projects", importance: 0.8, confidence: 0.9, updatedAt: new Date().toISOString() }, "TypeScript project answers");
    expect(score).toBeGreaterThanOrEqual(AETHER_MEMORY_RELEVANCE_THRESHOLD);
  });

  it("recognizes stale memory without deleting it", () => {
    const stale = evaluateAetherMemoryStaleness(new Date(Date.now() - 400 * 86_400_000).toISOString());
    expect(stale.stale).toBe(true);
    expect(stale.veryStale).toBe(false);
  });

  it("detects simple explicit contradiction pairs for evaluation", () => {
    expect(detectAetherMemoryContradiction("notifications are enabled", "notifications are disabled")).toBe(true);
    expect(detectAetherMemoryContradiction("User likes TypeScript", "User likes TypeScript")).toBe(false);
  });

  it("does not classify ordinary preferences as sensitive", () => {
    expect(classifyAetherMemoryContent("User prefers concise answers").persistenceAllowed).toBe(true);
  });

  it("blocks credentials, recovery secrets, OTPs and payment-card content from automatic persistence", () => {
    for (const value of ["my password is hunter2", "here is my private key", "seed phrase: one two three", "my OTP is 123456", "credit card 4111111111111111"]) {
      const result = classifyAetherMemoryContent(value);
      expect(result.sensitive).toBe(true);
      expect(result.persistenceAllowed).toBe(false);
    }
  });
});
