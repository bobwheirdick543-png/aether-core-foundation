/**
 * ADMIN AUTHORIZATION — server side only.
 *
 * The administrator passphrase lives exclusively in the server environment
 * variable AETHER_ADMIN_PASSWORD. It is never sent to, or compared in, the
 * browser. An optional AETHER_ADMIN_EMAIL restricts which signed-in account
 * may be elevated.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash, timingSafeEqual } from "node:crypto";

function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/** Elevate the currently signed-in account to ADMIN after passphrase check. */
export const adminElevate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { passphrase: string }) => {
    if (typeof data?.passphrase !== "string" || data.passphrase.length < 1) {
      throw new Error("Passphrase required");
    }
    return { passphrase: data.passphrase.slice(0, 512) };
  })
  .handler(async ({ data, context }) => {
    const expected = process.env["AETHER_ADMIN_PASSWORD"];
    if (!expected) return { ok: false as const, message: "Administrator access is not configured." };

    const allowedEmail = (process.env["AETHER_ADMIN_EMAIL"] ?? "").trim().toLowerCase();
    const callerEmail = String(context.claims?.["email"] ?? "").toLowerCase();
    if (allowedEmail && callerEmail !== allowedEmail) {
      return { ok: false as const, message: "This account is not permitted to sign in as administrator." };
    }

    if (!matches(data.passphrase, expected)) {
      return { ok: false as const, message: "Incorrect administrator passphrase." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) return { ok: false as const, message: "Could not grant administrator access." };

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "admin.session.granted",
      target_type: "user_roles",
      target_id: context.userId,
    });

    return { ok: true as const, message: "Administrator access granted." };
  });

/** Server-side role check. Never trust the client for this. */
export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (data ?? []).map((r) => r.role as string);
    return { userId: context.userId, roles, isAdmin: roles.includes("admin") };
  });

/** Admin-only platform overview. Enforced on the server, not in the UI. */
export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (table: string) => {
      const { count: c } = await supabaseAdmin
        .from(table as "profiles")
        .select("*", { count: "exact", head: true });
      return c ?? 0;
    };

    return {
      users: await count("profiles"),
      projects: await count("projects"),
      conversations: await count("conversations"),
      knowledge: await count("knowledge_entries"),
      reports: await count("reports"),
      tasks: await count("tasks"),
      apiKeys: await count("api_keys"),
    };
  });
