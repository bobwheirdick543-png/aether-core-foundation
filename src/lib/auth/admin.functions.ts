/**
 * ADMIN IDENTITY & AUTHORIZATION — server side only.
 *
 * The bootstrap secret lives exclusively in the server environment variable
 * AETHER_ADMIN_PASSWORD. It never reaches the browser.
 *
 * After bootstrap, the administrator signs in with a normal email + password.
 * The admin role is stored in public.user_roles and verified server-side.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash, timingSafeEqual } from "node:crypto";

const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MINUTES = 15;

function secretMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function callerFingerprint(): string {
  try {
    const req = getRequest();
    const h = req?.headers;
    return (
      h?.get("cf-connecting-ip") ??
      h?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h?.get("x-real-ip") ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

/** Public: can the administrator setup screen be used at all? Reveals nothing sensitive. */
export const getAdminBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const configured = Boolean(process.env["AETHER_ADMIN_PASSWORD"]);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("admin_bootstrap")
    .select("*", { count: "exact", head: true });
  return { configured, completed: (count ?? 0) > 0 };
});

/**
 * Public but secret-gated and rate limited: creates the FIRST administrator.
 * Refuses to run a second time.
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { secret: string; email: string; password: string; displayName?: string }) => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    const password = String(data?.password ?? "");
    const secret = String(data?.secret ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("A valid email is required.");
    if (password.length < 12) throw new Error("Password must be at least 12 characters.");
    if (!secret) throw new Error("Setup code is required.");
    return {
      secret: secret.slice(0, 512),
      email,
      password,
      displayName: String(data?.displayName ?? "").trim().slice(0, 80),
    };
  })
  .handler(async ({ data }) => {
    const expected = process.env["AETHER_ADMIN_PASSWORD"];
    if (!expected) {
      return { ok: false as const, message: "Administrator setup is not configured on this server." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fingerprint = callerFingerprint();
    const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60_000).toISOString();

    const { count: recentFailures } = await supabaseAdmin
      .from("admin_bootstrap_attempts")
      .select("*", { count: "exact", head: true })
      .eq("fingerprint", fingerprint)
      .eq("succeeded", false)
      .gte("attempted_at", since);

    if ((recentFailures ?? 0) >= MAX_FAILED_ATTEMPTS) {
      return { ok: false as const, message: "Too many attempts. Try again later." };
    }

    const { count: alreadyDone } = await supabaseAdmin
      .from("admin_bootstrap")
      .select("*", { count: "exact", head: true });
    if ((alreadyDone ?? 0) > 0) {
      return { ok: false as const, message: "An administrator already exists. Sign in instead." };
    }

    if (!secretMatches(data.secret, expected)) {
      await supabaseAdmin.from("admin_bootstrap_attempts").insert({ fingerprint, succeeded: false });
      return { ok: false as const, message: "Setup code rejected." };
    }

    let userId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName || data.email.split("@")[0] || data.email },
    });

    if (created.data?.user) {
      userId = created.data.user.id;
    } else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === data.email);
      if (!existing) {
        return { ok: false as const, message: "Could not create the administrator account." };
      }
      const updated = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: data.password,
        email_confirm: true,
      });
      if (updated.error) return { ok: false as const, message: "Could not update the existing account." };
      userId = existing.id;
    }

    await supabaseAdmin.from("profiles").upsert(
      { id: userId, display_name: data.displayName || data.email.split("@")[0] || data.email },
      { onConflict: "id" },
    );

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) return { ok: false as const, message: "Could not assign the administrator role." };

    await supabaseAdmin
      .from("admin_bootstrap")
      .insert({ id: true, completed_by: userId, completed_email: data.email });

    await supabaseAdmin.from("admin_bootstrap_attempts").insert({ fingerprint, succeeded: true });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "admin.bootstrap.completed",
      target_type: "user_roles",
      target_id: userId,
    });

    return { ok: true as const, message: "Administrator account created." };
  });

/**
 * Emergency recovery: change admin email and/or password using the setup code.
 * Always re-asserts the admin role so access cannot be lost.
 */
export const changeAdminCredentialsViaSetupCode = createServerFn({ method: "POST" })
  .inputValidator((data: {
    secret: string;
    currentEmail?: string;
    newEmail?: string;
    newPassword?: string;
  }) => {
    const secret = String(data?.secret ?? "").slice(0, 512);
    if (!secret) throw new Error("Setup code is required.");

    const currentEmail = data?.currentEmail
      ? String(data.currentEmail).trim().toLowerCase()
      : undefined;
    const newEmail = data?.newEmail
      ? String(data.newEmail).trim().toLowerCase()
      : undefined;
    const newPassword = data?.newPassword ? String(data.newPassword) : undefined;

    if (!newEmail && !newPassword) {
      throw new Error("Provide a new email and/or a new password.");
    }
    if (newEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      throw new Error("A valid new email is required.");
    }
    if (newPassword && newPassword.length < 12) {
      throw new Error("New password must be at least 12 characters.");
    }

    return { secret, currentEmail, newEmail, newPassword };
  })
  .handler(async ({ data }) => {
    const expected = process.env["AETHER_ADMIN_PASSWORD"];
    if (!expected) {
      return { ok: false as const, message: "Administrator recovery is not configured on this server." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fingerprint = callerFingerprint();
    const since = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60_000).toISOString();

    const { count: recentFailures } = await supabaseAdmin
      .from("admin_bootstrap_attempts")
      .select("*", { count: "exact", head: true })
      .eq("fingerprint", fingerprint)
      .eq("succeeded", false)
      .gte("attempted_at", since);

    if ((recentFailures ?? 0) >= MAX_FAILED_ATTEMPTS) {
      return { ok: false as const, message: "Too many attempts. Try again later." };
    }

    const { count: hasAdmin } = await supabaseAdmin
      .from("admin_bootstrap")
      .select("*", { count: "exact", head: true });
    if ((hasAdmin ?? 0) === 0) {
      return { ok: false as const, message: "No administrator has been initialized yet. Use the setup page." };
    }

    if (!secretMatches(data.secret, expected)) {
      await supabaseAdmin.from("admin_bootstrap_attempts").insert({ fingerprint, succeeded: false });
      return { ok: false as const, message: "Setup code rejected." };
    }

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(10);

    if (!roleRows || roleRows.length === 0) {
      return { ok: false as const, message: "No administrator role found." };
    }

    let targetUserId = roleRows[0].user_id as string;

    if (data.currentEmail) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = list?.users?.find(
        (u) =>
          (u.email ?? "").toLowerCase() === data.currentEmail &&
          roleRows.some((r) => r.user_id === u.id),
      );
      if (!match) {
        await supabaseAdmin.from("admin_bootstrap_attempts").insert({ fingerprint, succeeded: false });
        return { ok: false as const, message: "No administrator found with that email." };
      }
      targetUserId = match.id;
    }

    const updates: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (data.newEmail) {
      updates.email = data.newEmail;
      updates.email_confirm = true;
    }
    if (data.newPassword) {
      updates.password = data.newPassword;
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, updates);
    if (updateError) {
      await supabaseAdmin.from("admin_bootstrap_attempts").insert({ fingerprint, succeeded: false });
      return {
        ok: false as const,
        message: updateError.message || "Could not update administrator credentials.",
      };
    }

    // CRITICAL: always re-assert the admin role so access cannot be lost
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: targetUserId, role: "admin" }, { onConflict: "user_id,role" });

    // Keep bootstrap record in sync with the new email
    if (data.newEmail) {
      await supabaseAdmin
        .from("admin_bootstrap")
        .update({ completed_email: data.newEmail, completed_by: targetUserId })
        .eq("id", true);

      await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: targetUserId, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
    }

    await supabaseAdmin.from("admin_bootstrap_attempts").insert({ fingerprint, succeeded: true });

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: targetUserId,
      action: "admin.credentials.changed_via_setup_code",
      target_type: "auth.users",
      target_id: targetUserId,
      metadata: {
        email_changed: Boolean(data.newEmail),
        password_changed: Boolean(data.newPassword),
        via: "setup_code",
      },
    });

    return {
      ok: true as const,
      message:
        "Administrator credentials updated. Sign in with the new email and password. " +
        "If you changed the email, use the NEW email on the login form.",
    };
  });

/** Server-side role check. Never trust the client for this. */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Prefer service-role lookup so RLS cannot hide the admin role from the owner
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { userId: context.userId, roles, isAdmin: roles.includes("admin") };
  });

/**
 * Called right after an administrator signs in on /admin/login.
 * Uses service-role to verify the admin role so RLS cannot cause false denials.
 */
export const verifyAdminSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Primary: direct table check (reliable, ignores RLS)
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .limit(1);

    const isAdmin = (roleRows?.length ?? 0) > 0;

    // Fallback: RPC if table check is empty (covers alternate schema layouts)
    if (!isAdmin) {
      const { data: rpcAdmin } = await supabaseAdmin.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (!rpcAdmin) {
        return { ok: false as const, reason: "not_admin" as const };
      }
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin.session.started",
      target_type: "auth.users",
      target_id: context.userId,
    });

    return { ok: true as const };
  });
