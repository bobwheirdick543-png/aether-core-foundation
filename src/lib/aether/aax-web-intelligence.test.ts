import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Aether native web intelligence contract", () => {
  const source = readFileSync(resolve(process.cwd(), "src/lib/aether/aax-web-intelligence.ts"), "utf8");
  const gateway = readFileSync(resolve(process.cwd(), "src/lib/aether/aax-web-research.ts"), "utf8");
  const evolution = readFileSync(resolve(process.cwd(), "src/lib/aether/aax-knowledge-evolution-engine.ts"), "utf8");

  it("has independent no-key discovery adapters", () => {
    for (const marker of ["searchWikipedia", "searchReddit", "searchDuckDuckGo", "lookupDictionary"]) expect(source).toContain(marker);
    expect(source).toContain("Promise.allSettled(providers.map");
    expect(source).toContain("runAetherWebResearch");
  });

  it("retrieves sources concurrently and deduplicates them", () => {
    expect(source).toContain("dedupeHits");
    expect(source).toContain("Promise.allSettled(selected.map");
    expect(source).toContain("contentHash");
    expect(source).toContain("sourceDomains");
  });

  it("uses native web intelligence for the Phase D research toggle by default", () => {
    expect(gateway).toContain("runAetherWebResearch");
    expect(gateway).toContain('process.env.AETHER_NATIVE_WEB_RESEARCH !== "false"');
    expect(gateway).toContain("executeNative");
  });

  it("gives each learning agent an independent research pass", () => {
    expect(evolution).toContain("buildAgentResearchQuery");
    expect(evolution).toContain("runAetherWebResearch");
    expect(evolution).toContain('scope: "agent"');
    expect(evolution).toContain("webResearchSessionId");
  });
});
