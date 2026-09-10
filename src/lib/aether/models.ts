/** Aether model layer — Aether Ascension (AAX). */
import type { AaxCapability, AaxReleaseStatus } from "./aax";

export type ModelRoleKey = string;
export type SpeedIndicator = "fast" | "balanced" | "deliberate";
export type ModelStatus = AaxReleaseStatus;

export interface ModelRole {
  key: string;
  name: string;
  description: string;
  capabilities: string[];
  contextWindow: number;
  speed: SpeedIndicator;
  status: ModelStatus;
  generation: number;
  revision: number;
  specializations: string[];
}

export const AAX_MODEL_CATALOG: ModelRole[] = [
  { key: "aax-1.0", name: "Aether Ascension 1.0", description: "The first AAX generation: a unified Aether intelligence foundation.", capabilities: ["conversation", "knowledge", "reasoning", "tools"], contextWindow: 128_000, speed: "balanced", status: "draft", generation: 1, revision: 0, specializations: [] },
  { key: "aax-2.0", name: "Aether Ascension 2.0", description: "A later AAX generation with broader reasoning and multimodal capability targets.", capabilities: ["conversation", "knowledge", "reasoning", "tools", "multimodal"], contextWindow: 200_000, speed: "balanced", status: "draft", generation: 2, revision: 0, specializations: [] },
  { key: "aax-3.1", name: "Aether Ascension 3.1", description: "An evolving AAX generation designed for deeper reasoning, research and knowledge evolution.", capabilities: ["conversation", "knowledge", "reasoning", "advanced-reasoning", "tools", "multimodal", "streaming"], contextWindow: 200_000, speed: "balanced", status: "draft", generation: 3, revision: 1, specializations: [] },
  { key: "aax-4.0", name: "Aether Ascension 4.0", description: "A future AAX generation for higher capability and broader platform integration.", capabilities: ["conversation", "knowledge", "advanced-reasoning", "tools", "multimodal", "long-context", "streaming", "tool-calling"], contextWindow: 1_000_000, speed: "deliberate", status: "draft", generation: 4, revision: 0, specializations: [] },
  { key: "aax-5.1", name: "Aether Ascension 5.1", description: "A future AAX generation representing continued intelligence evolution.", capabilities: ["conversation", "knowledge", "advanced-reasoning", "tools", "multimodal", "long-context", "streaming", "tool-calling"], contextWindow: 1_000_000, speed: "deliberate", status: "draft", generation: 5, revision: 1, specializations: [] },
];

/** Compatibility export for existing Phase A/B consumers; it now resolves to AAX. */
export const MODEL_ROLES = AAX_MODEL_CATALOG;
export function getModelRole(key: string): ModelRole | undefined { return AAX_MODEL_CATALOG.find((m) => m.key === key); }
export function formatContext(tokens: number): string { return tokens >= 1_000_000 ? `${tokens / 1_000_000}M tokens` : `${Math.round(tokens / 1000)}K tokens`; }

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

export type { AaxCapability, AaxReleaseStatus };
export const MODEL_ROUTER_STATUS = "phase-c-aax-model-foundation" as const;
