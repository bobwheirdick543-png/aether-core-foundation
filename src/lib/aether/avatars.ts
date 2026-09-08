/** Built-in Aether avatars — decorative only; never affect permissions. */

export const AETHER_AVATARS = [
  { id: "orbit", label: "Orbit", emoji: "◉" },
  { id: "pulse", label: "Pulse", emoji: "◈" },
  { id: "signal", label: "Signal", emoji: "⟐" },
  { id: "node", label: "Node", emoji: "⬡" },
  { id: "core", label: "Core", emoji: "◎" },
  { id: "grid", label: "Grid", emoji: "▦" },
  { id: "wave", label: "Wave", emoji: "∿" },
  { id: "spark", label: "Spark", emoji: "✶" },
] as const;

export type AetherAvatarId = (typeof AETHER_AVATARS)[number]["id"];

export const AVATAR_BUCKET = "avatars";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export function isAetherAvatarId(value: string | null | undefined): value is AetherAvatarId {
  return Boolean(value && AETHER_AVATARS.some((a) => a.id === value));
}

export function randomAetherAvatarId(): AetherAvatarId {
  const i = Math.floor(Math.random() * AETHER_AVATARS.length);
  return AETHER_AVATARS[i]!.id;
}

/** Encode built-in avatar as a stable avatar_url value. */
export function avatarUrlForId(id: AetherAvatarId): string {
  return `aether-avatar:${id}`;
}

/** Storage object path for a user upload. */
export function avatarObjectPath(userId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  return `${userId}/${Date.now()}-${safe}`;
}

export function parseAvatarUrl(url: string | null | undefined): {
  kind: "builtin" | "upload" | "none";
  id?: AetherAvatarId;
  path?: string;
  src?: string;
} {
  if (!url) return { kind: "none" };
  if (url.startsWith("aether-avatar:")) {
    const id = url.slice("aether-avatar:".length);
    if (isAetherAvatarId(id)) return { kind: "builtin", id };
  }
  if (url.startsWith("storage:")) {
    return { kind: "upload", path: url.slice("storage:".length) };
  }
  // Legacy / external URL
  return { kind: "upload", src: url };
}

export function storageRefForPath(path: string): string {
  return `storage:${path}`;
}
