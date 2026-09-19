import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Number 19 — centralized agent web search", () => {
  const intelligence = readFileSync(resolve(process.cwd(), "src/lib/aether/aax-web-intelligence.ts"), "utf8");
  const planner = readFileSync(resolve(process.cwd(), "src/lib/aether/research-planner.ts"), "utf8");
  const executor = readFileSync(resolve(process.cwd(), "src/lib/aether/executor.ts"), "utf8");
  const acquisition = readFileSync(resolve(process.cwd(), "src/lib/aether/knowledge-acquisition-runtime.ts"), "utf8");
  const evolution = readFileSync(resolve(process.cwd(), "src/lib/aether/aax-knowledge-evolution-engine.ts"), "utf8");
  const nativeResearch = readFileSync(resolve(process.cwd(), "src/lib/aether/aax-web-research.ts"), "utf8");
  const env = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
  const agents = readFileSync(resolve(process.cwd(), "src/lib/aether/agents.ts"), "utf8");
  const boundary = readFileSync(resolve(process.cwd(), "src/lib/aether/agent-web-search.server.ts"), "utf8");

  it("keeps the provider credential server-side", () => {
    expect(env).toContain('EXA_API_KEY=""');
    expect(env).not.toContain("VITE_EXA_API_KEY");
    expect(env).not.toContain("\\nEXA_API_KEY");
    expect(boundary).toContain("aether_web_search_requests");
    expect(boundary).toContain('permission: "web.search"');
    expect(boundary).toContain("return searchWeb(input)");
  });

  it("forces agent research onto the centralized Exa provider", () => {
    expect(intelligence).toContain('input.searchAgent ? ["exa"]');
    expect(intelligence).toContain("searchWebForAgent");
  });

  it("passes an authenticated agent identity through research execution", () => {
    expect(planner).toContain("searchAgent:");
    expect(executor).toContain('agentKey: "research"');
    expect(acquisition).toContain('agentKey: "knowledge-acquisition"');
    expect(evolution).toContain("agentKey: agentKey");
    expect(nativeResearch).toContain('agentKey: "research"');
  });

  it("gives every web-capable specialist the same capability contract", () => {
    for (const key of ["research", "verification", "knowledge-acquisition", "curator", "security"]) {
      expect(agents).toContain(`def("${key}"`);
      expect(agents).toContain(`"${key}"`);
    }
    expect(agents).toContain('permission:"web.search"');
  });

  it("does not silently fall back to unrelated search providers for agent work", () => {
    expect(planner).not.toContain('providers: ["wikipedia", "reddit", "duckduckgo"]');
    expect(intelligence).toContain('const providerKeys = input.searchAgent ? ["exa"]');
  });
});
