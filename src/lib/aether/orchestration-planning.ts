export interface RouteCandidate { role: string; score: number; reasons: string[]; }

const ROLE_CAPABILITIES: Record<string, string[]> = {
  "aether-fast": ["general", "chat", "classification"],
  "aether-think": ["reasoning", "planning", "analysis"],
  "aether-code": ["code", "debugging", "development"],
  "aether-vision": ["vision", "image", "document"],
  "aether-long": ["long_context", "research", "large_document"],
  "aether-translate": ["translation", "language"],
};

export function chooseModelRole(capabilities: string[], requestedRole?: string | null): RouteCandidate {
  if (requestedRole && ROLE_CAPABILITIES[requestedRole]) return { role: requestedRole, score: 1, reasons: ["Explicitly requested model role"] };
  const normalized = capabilities.map((value) => value.toLowerCase());
  const ranked = Object.entries(ROLE_CAPABILITIES).map(([role, supported]) => {
    const matches = normalized.filter((capability) => supported.includes(capability)).length;
    const score = matches / Math.max(1, normalized.length);
    return { role, score, reasons: matches ? [`Matched ${matches} requested capability${matches === 1 ? "" : "ies"}`] : ["General fallback"] };
  }).sort((a, b) => b.score - a.score || a.role.localeCompare(b.role));
  return ranked[0] ?? { role: "aether-fast", score: 0, reasons: ["Safe default"] };
}

export function buildContextBudget(input: { maxTokens: number; systemTokens: number; historyTokens: number; knowledgeTokens: number; toolTokens: number }) {
  const totalReserved = Math.max(0, input.systemTokens) + Math.max(0, input.historyTokens) + Math.max(0, input.knowledgeTokens) + Math.max(0, input.toolTokens);
  const remaining = Math.max(0, input.maxTokens - totalReserved);
  return { maxTokens: input.maxTokens, reservedTokens: totalReserved, remainingTokens: remaining, fits: totalReserved <= input.maxTokens };
}

export function assessPlanForClarification(input: { message: string; intent: string; riskLevel: string; agents: string[] }) {
  const message = input.message.trim();
  const reasons: string[] = [];
  if (message.length < 3) reasons.push("The request is too short to determine intent safely.");
  if (input.riskLevel === "high" && !message) reasons.push("A high-risk action requires an explicit request.");
  if (!input.agents.length) reasons.push("No authorized execution path was identified.");
  return { needsClarification: reasons.length > 0, reasons };
}

export function evaluateStepOutcome(input: { success: boolean; retryable?: boolean; confidence?: number; requiredOutputPresent?: boolean }) {
  if (!input.success) return { status: input.retryable ? "retryable_failure" : "failure", escalate: !input.retryable } as const;
  if (input.requiredOutputPresent === false) return { status: "incomplete", escalate: true } as const;
  if (input.confidence != null && input.confidence < 0.6) return { status: "needs_review", escalate: true } as const;
  return { status: "accepted", escalate: false } as const;
}

export function chooseFallback(primary: string, unavailableRoles: string[]) {
  const fallbacks = ["aether-think", "aether-long", "aether-fast"].filter((role) => role !== primary && !unavailableRoles.includes(role));
  return fallbacks[0] ?? null;
}
