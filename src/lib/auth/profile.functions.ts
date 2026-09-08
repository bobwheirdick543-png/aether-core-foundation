/**
 * User profile read/update — authenticated owner only.
 * Avatars never affect roles or capabilities.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  avatarUrlForId,
  isAetherAvatarId,
  randomAetherAvatarId,
  storageRefForPath,
} from "@/lib/aether/avatars";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, preferred_language, default_model, response_style, memory_enabled, onboarding_completed, created_at, updated_at",
      )
      .eq("id", context.userId)
      .maybeSingle();

    const email = String(context.claims?.["email"] ?? "");

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    let avatarSignedUrl: string | null = null;
    const rawAvatar = profile?.avatar_url ?? null;
    if (rawAvatar?.startsWith("storage:")) {
      const path = rawAvatar.slice("storage:".length);
      const { data: signed } = await context.supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60);
      avatarSignedUrl = signed?.signedUrl ?? null;
    }

    return {
      email,
      profile: profile ?? {
        id: context.userId,
        display_name: null,
        avatar_url: null,
        preferred_language: "en",
        default_model: "aether-fast",
        response_style: "balanced",
        memory_enabled: true,
        onboarding_completed: false,
        created_at: null,
        updated_at: null,
      },
      avatarSignedUrl,
      roles: (roles ?? []).map((r) => r.role as string),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      displayName?: string;
      preferredLanguage?: string;
      defaultModel?: string;
      responseStyle?: string;
      memoryEnabled?: boolean;
      avatarChoice?: string; // builtin id | "random" | "clear"
      /** Storage object path under avatars/{userId}/… after client upload */
      avatarStoragePath?: string;
      onboardingCompleted?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};

    if (typeof data.displayName === "string") {
      patch.display_name = data.displayName.trim().slice(0, 80) || null;
    }
    if (typeof data.preferredLanguage === "string") {
      patch.preferred_language = data.preferredLanguage.trim().slice(0, 16) || "en";
    }
    if (typeof data.defaultModel === "string") {
      patch.default_model = data.defaultModel.trim().slice(0, 64) || "aether-fast";
    }
    if (typeof data.responseStyle === "string") {
      patch.response_style = data.responseStyle.trim().slice(0, 32) || "balanced";
    }
    if (typeof data.memoryEnabled === "boolean") {
      patch.memory_enabled = data.memoryEnabled;
    }
    if (typeof data.onboardingCompleted === "boolean") {
      patch.onboarding_completed = data.onboardingCompleted;
    }

    if (data.avatarChoice === "clear") {
      patch.avatar_url = null;
    } else if (data.avatarChoice === "random") {
      patch.avatar_url = avatarUrlForId(randomAetherAvatarId());
    } else if (typeof data.avatarChoice === "string" && isAetherAvatarId(data.avatarChoice)) {
      patch.avatar_url = avatarUrlForId(data.avatarChoice);
    } else if (typeof data.avatarStoragePath === "string") {
      // Must live under this user's folder only.
      const path = data.avatarStoragePath.replace(/^\/+/, "");
      if (!path.startsWith(`${context.userId}/`)) {
        return { ok: false as const, message: "Invalid avatar path." };
      }
      if (path.includes("..")) {
        return { ok: false as const, message: "Invalid avatar path." };
      }
      patch.avatar_url = storageRefForPath(path);
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true as const, message: "Nothing to update." };
    }

    const { error } = await context.supabase.from("profiles").upsert(
      { id: context.userId, ...patch },
      { onConflict: "id" },
    );
    if (error) return { ok: false as const, message: "Could not save profile." };

    return { ok: true as const, message: "Profile saved." };
  });
