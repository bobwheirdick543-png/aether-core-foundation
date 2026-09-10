/**
 * AETHER ADMIN IDENTITY & AUTHORIZATION — server side only.
 *
 * The single Aether administrator is defined by server-only Vercel variables:
 *   AETHER_ADMIN_EMAIL
 *   AETHER_ADMIN_PASSWORD
 *
 * Supabase Auth remains the session/identity provider and public.user_roles
 * remains the authorization source of truth. The browser never receives the
 * configured password.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalizeEmail(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function configuredAdminCredentials(): { email: string; password: string } | null {
  const email = normalizeEmail(process.env["AETHER_ADMIN_EMAIL"] ?? "");
  const password = String(process.env["AETHER_ADMIN_PASSWORD"] ?? "");
  if (!email || !validEmail(email) || password.length < 12) return null;
  return { email, password };
}

async function getOrCreateDesignatedAdmin() {
  const configured = configuredAdminCredentials();
  if (!configured) throw new Error("Aether administrator credentials are not configured on this server.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("Could not access the Aether administrator account.");

  let user = (users.users ?? []).find((candidate) => normalizeEmail(candidate.email ?? "") === configured.email);

  if (!user) {
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: configured.email,
      password: configured.password,
      email_confirm: true,
      user_metadata: { display_name: configured.email.split("@")[0] },
    });
    if (createError || !data.user) {
      throw new Error("Could not create the configured Aether administrator account.");
    }
    user = data.user;
  } else {
    // The Vercel environment is authoritative. Keep the Supabase Auth account
    // synchronized with it and remove the confirmation-email dependency.
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: configured.password,
      email_confirm: true,
    });
    if (updateError || !data.user) {
      throw new Error("Could not synchronize the Aether administrator credentials.");
    }
    user = data.user;
  }

  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });
  if (roleError) throw new Error("Could not assign the Aether administrator role.");

  // Single controlling admin identity: any older admin loses admin authority.
  await supabaseAdmin.from("user_roles").delete().eq("role", "admin").neq("user_id", user.id);

  await supabaseAdmin.from("profiles").upsert(
    {
      id: user.id,
      display_name: typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name.slice(0, 80)
        : configured.email.split("@")[0],
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  return user;
}

/**
 * Server-only administrator login. The submitted credentials must match the
 * Vercel environment variables exactly. Supabase Auth then issues the real
 * session used by the rest of the application.
 */
export const signInWithConfiguredAdminCredentials = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => ({
    email: normalizeEmail(data?.email),
    password: String(data?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const configured = configuredAdminCredentials();
    if (!configured) {
      return { ok: false as const, reason: "admin_credentials_not_configured" as const };
    }

    if (data.email !== configured.email || data.password !== configured.password) {
      return { ok: false as const, reason: "invalid_credentials" as const };
    }

    const user = await getOrCreateDesignatedAdmin();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: config } = await supabaseAdmin.from("app_config").select("key,value").limit(1);
    void config;

    // Use a server-side Supabase Auth client only to exchange the verified
    // environment credentials for a normal Supabase session.
    const { createClient } = await import("@supabase/supabase-js");
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = {
      SUPABASE_URL: process.env["SUPABASE_URL"],
      SUPABASE_PUBLISHABLE_KEY: process.env["SUPABASE_PUBLISHABLE_KEY"],
    };
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return { ok: false as const, reason: "supabase_not_configured" as const };
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({
      email: configured.email,
      password: configured.password,
    });

    if (signInError || !sessionData.session) {
      return { ok: false as const, reason: "supabase_signin_failed" as const };
    }

    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      actor_id: user.id,
      action: "admin.session.started",
      target_type: "auth.users",
      target_id: user.id,
      metadata: { authorization_source: "VERCEL_ENV_CREDENTIALS" },
    });
    if (auditError) console.warn("[Aether] Admin audit log failed:", auditError.message);

    return {
      ok: true as const,
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at ?? null,
        expires_in: sessionData.session.expires_in,
        token_type: sessionData.session.token_type,
        user: sessionData.session.user,
      },
    };
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
 * Compatibility verifier for existing authenticated admin sessions. The
 * configured Vercel email remains authoritative and the role is synchronized.
 */
export const verifyAdminSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const configured = configuredAdminCredentials();
    if (!configured) return { ok: false as const, reason: "admin_credentials_not_configured" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);

    if (error || !userData.user) return { ok: false as const, reason: "invalid_user" as const };
    if (normalizeEmail(userData.user.email ?? "") !== configured.email) {
      return { ok: false as const, reason: "not_designated_admin" as const };
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) return { ok: false as const, reason: "role_assignment_failed" as const };

    await supabaseAdmin.from("user_roles").delete().eq("role", "admin").neq("user_id", context.userId);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin.session.started",
      target_type: "auth.users",
      target_id: context.userId,
      metadata: { authorization_source: "VERCEL_ENV_CREDENTIALS" },
    });

    return { ok: true as const };
  });
