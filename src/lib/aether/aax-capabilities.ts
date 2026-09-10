export const AAX_CAPABILITIES = ["reasoning","coding","vision","audio","multimodal","tool_calling","structured_output","streaming","long_context","research"] as const;
export type AaxCapability = typeof AAX_CAPABILITIES[number];

export interface AaxCapabilityRequirements {
  required?: AaxCapability[];
  preferred?: AaxCapability[];
}

export function meetsAaxCapabilities(capabilities: string[], requirements: AaxCapabilityRequirements = {}) {
  const available = new Set(capabilities);
  return (requirements.required ?? []).every((capability) => available.has(capability));
}

export function capabilityScore(capabilities: string[], requirements: AaxCapabilityRequirements = {}) {
  const available = new Set(capabilities);
  const preferred = requirements.preferred ?? [];
  if (!preferred.length) return 0;
  return preferred.reduce((score, capability) => score + (available.has(capability) ? 1 : 0), 0) / preferred.length;
}
