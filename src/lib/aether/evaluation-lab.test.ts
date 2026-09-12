import { describe, expect, it } from "vitest";
import { classifyIntent, validateOrchestrationPlan } from "./orchestrator";

describe("Phase V evaluation contracts", () => {
  it("evaluates real orchestrator planning output without simulation", () => {
    const plan = classifyIntent("Research and verify this claim and create a report");
    expect(plan.intent).toContain("research");
    expect(plan.agents).toContain("research");
    expect(plan.agents).toContain("verification");
    expect(plan.agents).toContain("report");
    expect(validateOrchestrationPlan(plan)).toBe(true);
  });

  it("requires approval for high-risk orchestration plans", () => {
    const plan = classifyIntent("send this to the user and change settings");
    expect(plan.riskLevel).toBe("high");
    expect(plan.approvalRequired).toBe(true);
  });
});
