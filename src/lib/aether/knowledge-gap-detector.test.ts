import { describe, expect, it } from "vitest";
import { assessKnowledgeGap } from "./knowledge-gap-detector";

describe("assessKnowledgeGap", () => {
  it("does not acquire for casual short messages", () => {
    expect(assessKnowledgeGap("hi there").shouldAcquire).toBe(false);
  });

  it("detects a substantive knowledge request with no coverage", () => {
    const result = assessKnowledgeGap("Explain the history and capabilities of quantum networking", []);
    expect(result.shouldAcquire).toBe(true);
    expect(result.reason).toBe("insufficient-approved-knowledge-coverage");
  });

  it("does not acquire when approved knowledge covers the request", () => {
    const result = assessKnowledgeGap(
      "Explain the history and capabilities of quantum networking",
      ["quantum networking history capabilities are documented here"],
    );
    expect(result.shouldAcquire).toBe(false);
    expect(result.reason).toBe("sufficient-known-coverage");
  });

  it("does not acquire for ordinary non-knowledge chatter", () => {
    expect(assessKnowledgeGap("That sounds really good, thanks!").shouldAcquire).toBe(false);
  });
});
