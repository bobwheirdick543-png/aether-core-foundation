/**
 * ADMIN IDENTITY & AUTHORIZATION — server side only.
 *
 * The only account that can become the Aether administrator is the exact email
 * configured in AETHER_ADMIN_EMAIL. The value is never exposed to the browser.
 * Supabase Auth remains the identity provider; public.user_roles remains the
 * authorization source of truth.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalizeEmail(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function configuredAdminEmail(): string | null {
  const value = normalizeEmail(process.env["AETHER_ADMIN_EMAIL"] ?? "");
  return value && validEmail(value) ? value : null;
}

async function claimDesignatedAdmin(userId: string, email: string, displayName?: string) {
  const configured = configuredAdminEmail();
  if (!configured || normalizeEmail(email) !== configured) {
    return { ok: false as const, reason: "not_designated_admin" as const };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // The designated admin is the single controlling admin identity.
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  if (roleError) {
    return { ok: false as const, reason: "role_assignment_failed" as const };
  }

  // If an older bootstrap admin exists, it must not retain admin authority.
  await supabaseAdmin.from("user_roles").delete().eq("role", "admin").neq("user_id", userId);

  await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      display_name: displayName?.trim().slice(0, 80) || email.split("@")[0] || email,
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: userId,
    action: "admin.designated_account.verified",
    target_type: "auth.users",
    target_id: userId,
    metadata: { authorization_source: "AETHER_ADMIN_EMAIL" },
  });

  return { ok: true as const };
}

/** Public preflight for the dedicated administrator signup page. */
export const validateAdminSignupEmail = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string }) => {
    const email = normalizeEmail(data?.email);
    if (!validEmail(email)) throw new Error("A valid email is required.");
    return { email };
  })
  .handler(async ({ data }) => {
    const configured = configuredAdminEmail();
    if (!configured) {
      return { ok: false as const, message: "Administrator signup is not configured on this server." };
    }

    if (data.email !== configured) {
      return { ok: false as const, message: "This email is not authorized for administrator signup." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      return { ok: false as const, message: "Could not verify administrator signup availability." };
    }

    const exists = (users.users ?? []).some((u) => normalizeEmail(u.email ?? "") === configured);
    if (exists) {
      return { ok: false as const, message: "The designated administrator account already exists. Sign in instead." };
    }

    return { ok: true as const };
  });

/**
 * Called after Supabase Auth sign-up. This does not create the Auth account itself;
 * Supabase Auth client signUp() sends the confirmation email. This server function
 * is the authoritative gate that assigns admin privileges after confirmation/login.
 */
export const verifyAdminAccessToken = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => {
    const accessToken = String(data?.accessToken ?? "").trim();
    if (!accessToken || accessToken.split(".").length !== 3) {
      throw new Error("Valid access token is required.");
    }
    return { accessToken };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);

    if (userError || !userData?.user?.id) {
      return { ok: false as const, reason: "invalid_token" as const };
    }

    const user = userData.user;
    const email = normalizeEmail(user.email ?? "");
    const configured = configuredAdminEmail();

    if (!configured || email !== configured) {
      return { ok: false as const, reason: "not_designated_admin" as const };
    }

    if (!user.email_confirmed_at) {
      return { ok: false as const, reason: "email_not_confirmed" as const };
    }

    const claimed = await claimDesignatedAdmin(
      user.id,
      email,
      typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : undefined,
    );

    if (!claimed.ok) {
      return { ok: false as const, reason: claimed.reason };
    }

    return { ok: true as const, userId: user.id };
  });

/** Server-side role check. Never trust the client for this. */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { userId: context.userId, roles, isAdmin: roles.includes("admin") };
  });

/**
 * Server-side session verification. The designated email is authoritative;
 * the database role is synchronized from that identity instead of trusting a
 * role created by an older setup flow.
 */
export const verifyAdminSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);

    if (error || !userData.user) return { ok: false as const, reason: "invalid_user" as const };
    if (!userData.user.email_confirmed_at) {
      return { ok: false as const, reason: "email_not_confirmed" as const };
    }

    const claimed = await claimDesignatedAdmin(
      context.userId,
      userData.user.email ?? "",
      typeof userData.user.user_metadata?.display_name === "string"
        ? userData.user.user_metadata.display_name
        : undefined,
    );

    if (!claimed.ok) return { ok: false as const, reason: claimed.reason };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin.session.started",
      target_type: "auth.users",
      target_id: context.userId,
    });

    return { ok: true as const };
  });
