import assert from "node:assert/strict";
import test from "node:test";
import { classifyIntent, validateOrchestrationPlan } from "./orchestrator.ts";

test("Phase B classifies a multi-action research request", () => {
  const plan = classifyIntent("Research this subject, verify the important claims, and make a report.");
  assert.equal(plan.intent, "research");
  assert.ok(plan.capabilities.includes("research"));
  assert.ok(plan.capabilities.includes("verification"));
  assert.ok(plan.capabilities.includes("report"));
  assert.ok(plan.agents.includes("research"));
  assert.ok(plan.agents.includes("verification"));
  assert.ok(plan.agents.includes("report"));
  assert.equal(validateOrchestrationPlan(plan), true);
});

test("Phase B marks destructive or privileged requests for approval", () => {
  const plan = classifyIntent("Delete the project and remove all its files.");
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.riskLevel, "high");
});

test("Phase B does not invent an agent for an ordinary answer", () => {
  const plan = classifyIntent("Explain what a database index does.");
  assert.ok(plan.agents.length >= 1);
  assert.equal(validateOrchestrationPlan(plan), true);
});
