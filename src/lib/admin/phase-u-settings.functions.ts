import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUnsafePhaseUSettingKey, redactPhaseUAuditMetadata } from "@/lib/admin/phase-u-security";

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const { data, error } = await (context.supabase as SupabaseClient).rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Response("Unable to verify administrator authorization", { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

async function audit(actorId: string, action: string, targetId: string, metadata: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: actorId,
    action,
    target_type: "platform_setting",
    target_id: targetId,
    metadata: redactPhaseUAuditMetadata(metadata),
  });
  if (error) throw new Response("Audit write failed", { status: 500 });
}

export const getPhaseUSafeSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("key,value,description,updated_at,updated_by")
      .order("key");
    if (error) throw new Response("Could not load platform settings", { status: 500 });
    return data ?? [];
  });

export const setPhaseUSafeSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; value: unknown; description?: string }) => ({
    key: String(d.key).trim().slice(0, 120),
    value: d.value,
    description: d.description?.trim().slice(0, 500),
  }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (!data.key) throw new Response("Setting key is required", { status: 400 });
    if (isUnsafePhaseUSettingKey(data.key)) {
      throw new Response("Secret-like values must remain in server-side secret storage", { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("platform_settings")
      .upsert({
        key: data.key,
        value: data.value,
        description: data.description ?? null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .select("key,value,description,updated_at,updated_by")
      .single();

    if (error || !row) throw new Response(error?.message ?? "Could not save setting", { status: 500 });
    await audit(context.userId, "admin.platform_setting_changed", data.key, {
      value: data.value,
      description: data.description ?? null,
    });
    return row;
  });
