import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Phase F completion gate", () => {
  const root = process.cwd();
  const migration = readFileSync(resolve(root, "supabase/migrations/20260911160000_phase_f_completion_hardening.sql"), "utf8");
  const audit = readFileSync(resolve(root, "docs/architecture/phase-f-audit-gap-matrix.md"), "utf8");
  const executor = readFileSync(resolve(root, "src/lib/aether/executor.ts"), "utf8");
  const worker = readFileSync(resolve(root, "src/lib/aether/runtime-worker.ts"), "utf8");
  const research = readFileSync(resolve(root, "src/lib/aether/aax-web-intelligence.ts"), "utf8");
  const planner = readFileSync(resolve(root, "src/lib/aether/research-planner.ts"), "utf8");

  it("has durable project-scoped provenance and discovery storage", () => {
    expect(migration).toContain("aether_research_source_versions");
    expect(migration).toContain("aether_research_retrieval_attempts");
    expect(migration).toContain("aether_research_discovery_events");
    expect(migration).toContain("project_id uuid");
    expect(migration).toContain("research_discovery_events_immutable");
    expect(migration).toContain("supabase_realtime");
  });
  it("routes topic research through the durable runtime and cancellation signal", () => {
    expect(executor).toContain("runPlannedResearch");
    expect(executor).toContain("runtimeAbort.controller.signal");
    expect(worker).toContain('work.task_kind === "research"');
    expect(worker).toContain("project_id: work.project_id");
  });
  it("persists parser metadata, source history, and discovery events", () => {
    expect(research).toContain("parserVersion");
    expect(research).toContain("version_number");
    expect(research).toContain("change_state");
    expect(planner).toContain("persistResearchDiscoveryEvent");
    expect(planner).toContain("unmetRequirements");
  });
  it("keeps the audit matrix as an explicit completion record rather than silently hiding gaps", () => {
    expect(audit).toContain("F14");
    expect(audit).toContain("completion gate");
  });
});
