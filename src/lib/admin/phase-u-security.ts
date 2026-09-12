const SECRET_KEY_PATTERN = /(secret|password|token|api[_-]?key|private[_-]?key|credential|authorization|cookie|service[_-]?role)/i;

/**
 * Prevent privileged audit metadata from becoming a second secret store.
 * Audit trails retain the action and shape of a change, but never raw secret-like values.
 */
export function redactPhaseUAuditMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPhaseUAuditMetadata);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactPhaseUAuditMetadata(entry);
  }
  return output;
}

export function isUnsafePhaseUSettingKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}
