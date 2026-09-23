/**
 * AETHER ADMIN IDENTITY & AUTHORIZATION — server side only.
 *
 * The bootstrap administrator is identified by the server-only
 * AETHER_ADMIN_EMAIL. The password is owned by Supabase Auth and is never
 * stored, compared, created, or reset by Aether configuration.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAdminSessionCookies } from "@/lib/auth/admin.session.server";

function normalizeEmail(value: string): string { return String(value ?? "").trim().toLowerCase(); }
function validEmail(value: string): boolean { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value); }
function configuredAdminEmail(): string | null { const email = normalizeEmail(process.env["AETHER_ADMIN_EMAIL"] ?? ""); return email && validEmail(email) ? email : null; }

async function ensureBootstrapAdmin(userId: string, expectedEmail: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !userData.user) throw new Error("Could not verify the Aether administrator account.");
  const actualEmail = normalizeEmail(userData.user.email ?? "");
  if (actualEmail !== expectedEmail) throw new Error("Authenticated account is not the configured Aether administrator.");
  const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (roleError) throw new Error("Could not assign the Aether administrator role.");
  await supabaseAdmin.from("profiles").upsert({ id: userId, display_name: typeof userData.user.user_metadata?.display_name === "string" ? userData.user.user_metadata.display_name.slice(0, 80) : expectedEmail.split("@")[0], onboarding_completed: true, updated_at: new Date().toISOString() }, { onConflict: "id" });
  return userData.user;
}

export const signInWithConfiguredAdminCredentials = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => ({ email: normalizeEmail(data?.email), password: String(data?.password ?? "") }))
  .handler(async ({ data }) => {
    const configuredEmail = configuredAdminEmail();
    if (!configuredEmail) return { ok: false as const, reason: "admin_email_not_configured" as const };
    if (data.email !== configuredEmail || !data.password) return { ok: false as const, reason: "invalid_credentials" as const };
    const SUPABASE_URL = process.env["SUPABASE_URL"];
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return { ok: false as const, reason: "supabase_not_configured" as const };
    const { createClient } = await import("@supabase/supabase-js");
    const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: sessionData, error: signInError } = await authClient.auth.signInWithPassword({ email: configuredEmail, password: data.password });
    if (signInError || !sessionData.session) return { ok: false as const, reason: "supabase_signin_failed" as const };
    const user = await ensureBootstrapAdmin(sessionData.session.user.id, configuredEmail);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    writeAdminSessionCookies(sessionData.session.access_token, sessionData.session.refresh_token);
    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({ actor_id: user.id, action: "admin.session.started", target_type: "auth.users", target_id: user.id, metadata: { authorization_source: "SUPABASE_AUTH_BOOTSTRAP_EMAIL" } });
    if (auditError) console.warn("[Aether] Admin audit log failed:", auditError.message);
    return { ok: true as const, session: { access_token: sessionData.session.access_token, refresh_token: sessionData.session.refresh_token, expires_at: sessionData.session.expires_at ?? null, expires_in: sessionData.session.expires_in, token_type: sessionData.session.token_type, user: sessionData.session.user } };
  });

export const getMyRoles = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
  const roles = (data ?? []).map((r) => r.role as string);
  return { userId: context.userId, roles, isAdmin: roles.includes("admin") };
});

export const verifyAdminSignIn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const configuredEmail = configuredAdminEmail();
  if (!configuredEmail) return { ok: false as const, reason: "admin_email_not_configured" as const };
  try {
    await ensureBootstrapAdmin(context.userId, configuredEmail);
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "not_designated_admin" as const };
  }
});