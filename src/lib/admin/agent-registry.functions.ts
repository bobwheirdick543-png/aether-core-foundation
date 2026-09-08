/**
 * Admin-only: synchronise the static AGENTS definitions into the database.
 * No fake activity or telemetry is created.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncAgentRegistry } from "@/lib/aether/agent-registry";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const syncAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const result = await syncAgentRegistry(supabaseAdmin);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "agents.registry.synced",
      target_type: "agents",
      metadata: { upserted: result.upserted },
    });

    return result;
  });
