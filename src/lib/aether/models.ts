/**
 * AETHER MODEL LAYER — architecture only.
 *
 * UI never talks to an AI provider directly. It selects a *model role*.
 * A future ModelRouter maps a role to a concrete provider + model.
 *
 * STATUS: types + static catalog implemented. Provider execution: Phase 4.
 */

export type ModelRoleKey =
  | "aether-fast"
  | "aether-think"
  | "aether-code"
  | "aether-vision"
  | "aether-long"
  | "aether-translate";

export type SpeedIndicator = "fast" | "balanced" | "deliberate";
export type ModelStatus = "planned" | "beta" | "available" | "offline";

export interface ModelRole {
  key: ModelRoleKey;
  name: string;
  description: string;
  capabilities: string[];
  contextWindow: number;
  speed: SpeedIndicator;
  status: ModelStatus;
}

export const MODEL_ROLES: ModelRole[] = [
  {
    key: "aether-fast",
    name: "Aether Fast",
    description: "Optimized for fast everyday conversations.",
    capabilities: ["Chat", "Summaries", "Drafting"],
    contextWindow: 128_000,
    speed: "fast",
    status: "planned",
  },
  {
    key: "aether-think",
    name: "Aether Think",
    description: "Designed for deeper reasoning and complex analysis.",
    capabilities: ["Reasoning", "Analysis", "Planning"],
    contextWindow: 200_000,
    speed: "deliberate",
    status: "planned",
  },
  {
    key: "aether-code",
    name: "Aether Code",
    description: "Designed for programming and technical tasks.",
    capabilities: ["Code", "Debugging", "Refactoring"],
    contextWindow: 200_000,
    speed: "balanced",
    status: "planned",
  },
  {
    key: "aether-vision",
    name: "Aether Vision",
    description: "Designed for images, screenshots and visual documents.",
    capabilities: ["Vision", "OCR", "Diagrams"],
    contextWindow: 128_000,
    speed: "balanced",
    status: "planned",
  },
  {
    key: "aether-long",
    name: "Aether Long",
    description: "Designed for long documents and large-context tasks.",
    capabilities: ["Long context", "Documents", "Corpus review"],
    contextWindow: 1_000_000,
    speed: "deliberate",
    status: "planned",
  },
  {
    key: "aether-translate",
    name: "Aether Translate",
    description: "Optimized for multilingual communication and translation.",
    capabilities: ["Translation", "Localization", "Tone matching"],
    contextWindow: 128_000,
    speed: "fast",
    status: "planned",
  },
];

export function getModelRole(key: string): ModelRole | undefined {
  return MODEL_ROLES.find((m) => m.key === key);
}

export function formatContext(tokens: number): string {
  return tokens >= 1_000_000
    ? `${tokens / 1_000_000}M tokens`
    : `${Math.round(tokens / 1000)}K tokens`;
}

/* ---------- Provider abstraction (no implementation yet) ---------- */

export interface AIRequest {
  role: ModelRoleKey;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  projectId?: string;
  conversationId?: string;
  useMemory?: boolean;
  useWebResearch?: boolean;
}

export interface AIResponse {
  content: string;
  modelRole: ModelRoleKey;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  toolCalls: { name: string; status: "pending" | "done" | "failed" }[];
}

export interface ModelProvider {
  id: string;
  supports(role: ModelRoleKey): boolean;
  execute(request: AIRequest): Promise<AIResponse>;
}

export interface ModelRouter {
  register(provider: ModelProvider): void;
  resolve(role: ModelRoleKey): ModelProvider | undefined;
  route(request: AIRequest): Promise<AIResponse>;
}

/** Phase 4 will register real providers here. Deliberately not implemented. */
export const MODEL_ROUTER_STATUS = "not-implemented" as const;
