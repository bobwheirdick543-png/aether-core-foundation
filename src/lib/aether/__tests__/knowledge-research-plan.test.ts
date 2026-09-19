import { describe, expect, it } from "vitest";
import { aspectProgress, buildKnowledgeResearchAspects } from "../knowledge-research-plan";

describe("knowledge research aspects", () => {
  it("creates explicit bounded research aspects instead of one opaque research step", () => {
    const aspects = buildKnowledgeResearchAspects("quantum physics");
    expect(aspects).toHaveLength(6);
    expect(aspects.every((aspect) => aspect.required && aspect.query.length > 0)).toBe(true);
    expect(new Set(aspects.map((aspect) => aspect.id)).size).toBe(6);
  });

  it("reports persisted aspect progress deterministically", () => {
    const aspects = buildKnowledgeResearchAspects("quantum physics");
    expect(aspectProgress(aspects, [])).toBe(0);
    expect(aspectProgress(aspects, ["core", "history"])).toBe(33);
    expect(aspectProgress(aspects, aspects.map((aspect) => aspect.id))).toBe(100);
  });
});
