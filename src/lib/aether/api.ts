/** API key scope catalog. Key issuing/verification lands in Phase 10. */

export const API_SCOPES = [
  { scope: "chat", label: "Send chat requests" },
  { scope: "models", label: "List model roles" },
  { scope: "knowledge.read", label: "Read production knowledge" },
  { scope: "research", label: "Start and read research runs" },
  { scope: "projects.read", label: "Read projects" },
  { scope: "projects.write", label: "Create and update projects" },
  { scope: "modules.read", label: "Read module definitions" },
  { scope: "modules.execute", label: "Execute module commands" },
] as const;

export type ApiScope = (typeof API_SCOPES)[number]["scope"];

/**
 * Storage strategy: only a SHA-256 hash and a short prefix of a key are ever
 * persisted (`api_keys.key_hash`, `api_keys.key_prefix`). The full key is shown
 * to the user exactly once, at creation time, and never retrievable again.
 */
export const API_KEY_STORAGE_NOTE =
  "Only a hash and the first characters of a key are stored. The full key is shown once.";
