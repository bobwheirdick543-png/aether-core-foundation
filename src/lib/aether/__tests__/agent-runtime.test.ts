import { describe, expect, it } from "vitest";
import { AGENTS } from "../agents";
import { buildAgentVersion, validateAgentDefinition, assertLifecycleTransition } from "../agent-runtime";
import { mergeStaticContract } from "../agent-registry";

// Phase M final regression gate: contracts, boundaries and lifecycle must stay valid.
describe("Phase M Agent SDK", () => {
  it("keeps the complete ten-agent registry", () => { expect(AGENTS).toHaveLength(10); expect(new Set(AGENTS.map((agent) => agent.key)).size).toBe(10); });
  it("builds valid strongly typed contracts", () => { for (const agent of AGENTS) { const definition = mergeStaticContract(agent.key); expect(validateAgentDefinition(definition)).toEqual([]); expect(buildAgentVersion(agent).configurationHash).toMatch(/^[0-9a-f]{8}$/); } });
  it("rejects permission-boundary self escalation", () => { const definition = mergeStaticContract("module", { permissions: [{ permission: "roles.modify", label: "bad", allowed: true }] }); expect(validateAgentDefinition(definition).some((message) => message.includes("self-modification") || message.includes("permission"))).toBe(true); });
  it("enforces the lifecycle gates", () => { expect(() => assertLifecycleTransition("draft", "validated")).not.toThrow(); expect(() => assertLifecycleTransition("validated", "tested")).not.toThrow(); expect(() => assertLifecycleTransition("tested", "active")).not.toThrow(); expect(() => assertLifecycleTransition("draft", "active")).toThrow(); expect(() => assertLifecycleTransition("active", "draft")).toThrow(); });
});
