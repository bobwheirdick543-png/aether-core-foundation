export type AaxReleaseStatus =
  | "draft"
  | "training"
  | "evaluation"
  | "approved"
  | "scheduled"
  | "announced"
  | "available"
  | "deprecated"
  | "retired";

export const AAX_CAPABILITIES = [
  "reasoning",
  "conversation",
  "knowledge",
  "tools",
  "structured-output",
  "vision",
  "multimodal",
  "long-context",
  "advanced-reasoning",
  "streaming",
  "tool-calling",
] as const;

export type AaxCapability = (typeof AAX_CAPABILITIES)[number];

export interface AaxModelDefinition {
  modelKey: string;
  displayName: string;
  generation: number;
  revision: number;
  provider?: string;
  providerModel?: string;
  capabilities: AaxCapability[];
  specializations: string[];
  releaseStatus: AaxReleaseStatus;
  scheduledReleaseAt?: string;
  availableAt?: string;
}

export function isAaxAvailable(model: Pick<AaxModelDefinition, "releaseStatus" | "availableAt">, now = new Date()): boolean {
  if (model.releaseStatus !== "available") return false;
  if (!model.availableAt) return true;
  return new Date(model.availableAt).getTime() <= now.getTime();
}

export const AAX_MODEL_FAMILY = "Aether Ascension" as const;
