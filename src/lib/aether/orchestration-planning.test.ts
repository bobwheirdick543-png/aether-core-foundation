import assert from "node:assert/strict";
import test from "node:test";
import { assessPlanForClarification, buildContextBudget, chooseFallback, chooseModelRole, evaluateStepOutcome } from "./orchestration-planning.ts";

test("routing selects code role for code capability", () => assert.equal(chooseModelRole(["code"]).role, "aether-code"));
test("explicit model role wins over capability inference", () => assert.equal(chooseModelRole(["code"], "aether-fast").role, "aether-fast"));
test("context budget never becomes negative", () => assert.deepEqual(buildContextBudget({ maxTokens: 1000, systemTokens: 400, historyTokens: 400, knowledgeTokens: 300, toolTokens: 100 }).remainingTokens, 0));
test("ambiguous empty request asks for clarification", () => assert.equal(assessPlanForClarification({ message: "", intent: "general", riskLevel: "low", agents: ["orchestrator"] }).needsClarification, true));
test("low-confidence output is not silently accepted", () => assert.equal(evaluateStepOutcome({ success: true, confidence: 0.4 }).status, "needs_review"));
test("fallback excludes unavailable primary and roles", () => assert.equal(chooseFallback("aether-fast", ["aether-think"]), "aether-long"));
