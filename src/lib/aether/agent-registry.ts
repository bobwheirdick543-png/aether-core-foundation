/**
 * AETHER AGENT REGISTRY
 *
 * Syncs the static AGENTS contracts into the database so the Team dashboard
 * and runtime can read real rows. Does not invent telemetry or open tasks.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENTS } from "./agents";

export async function syncAgentRegistry(admin: SupabaseClient): Promise<{ upserted: number }> {
  let upserted = 0;

  for (const agent of AGENTS) {
    const { data: existing } = await admin
      .from("agents")
      .select("id")
      .eq("agent_key", agent.key)
      .maybeSingle();

    let agentId = existing?.id as string | undefined;

    if (!agentId) {
      const { data: inserted, error } = await admin
        .from("agents")
        .insert({
          agent_key: agent.key,
          name: agent.name,
          description: agent.description,
          purpose: agent.purpose,
          status: agent.status,
          tools: agent.tools,
          last_activity_at: null,
        })
        .select("id")
        .single();
      if (error || !inserted) continue;
      agentId = inserted.id;
      upserted += 1;
    } else {
      await admin
        .from("agents")
        .update({
          name: agent.name,
          description: agent.description,
          purpose: agent.purpose,
          status: agent.status,
          tools: agent.tools,
        })
        .eq("id", agentId);
      upserted += 1;
    }

    // Sync permissions
    for (const perm of agent.permissions) {
      await admin.from("agent_permissions").upsert(
        {
          agent_id: agentId,
          permission: perm.permission,
          allowed: perm.allowed,
          requires_approval: Boolean(perm.requiresApproval),
        },
        { onConflict: "agent_id,permission" },
      );
    }
  }

  return { upserted };
}
