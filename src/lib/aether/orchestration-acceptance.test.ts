import assert from "node:assert/strict";
import test from "node:test";
import { chooseModelRole, buildContextBudget, evaluateStepOutcome } from "./orchestration-planning.ts";

test("Phase B acceptance: all six product model roles are routable", () => {
  for (const role of ["aether-fast", "aether-think", "aether-code", "aether-vision", "aether-long", "aether-translate"]) {
    assert.equal(chooseModelRole([], role).role, role);
  }
});

test("Phase B acceptance: context budget reports overflow instead of silently exceeding limit", () => {
  const budget = buildContextBudget({ maxTokens: 1000, systemTokens: 600, historyTokens: 500, knowledgeTokens: 0, toolTokens: 0 });
  assert.equal(budget.fits, false);
  assert.equal(budget.remainingTokens, 0);
});

test("Phase B acceptance: failed work is explicitly retryable or escalated", () => {
  assert.equal(evaluateStepOutcome({ success: false, retryable: true }).status, "retryable_failure");
  assert.equal(evaluateStepOutcome({ success: false, retryable: false }).escalate, true);
});
