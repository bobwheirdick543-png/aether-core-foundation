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

export function parseAvatarUrl(url: string | null | undefined): {
  kind: "builtin" | "upload" | "none";
  id?: AetherAvatarId;
  src?: string;
} {
  if (!url) return { kind: "none" };
  if (url.startsWith("aether-avatar:")) {
    const id = url.slice("aether-avatar:".length);
    if (isAetherAvatarId(id)) return { kind: "builtin", id };
  }
  return { kind: "upload", src: url };
}
