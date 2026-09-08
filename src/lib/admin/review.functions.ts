/**
 * ADMIN REVIEW QUEUE
 * Central place for items that require administrator attention.
 * Real data only — empty when nothing is pending.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const getAdminReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Tasks waiting for approval
    const { data: waitingTasks } = await supabaseAdmin
      .from("tasks")
      .select("id, title, kind, status, owner_id, created_at, updated_at")
      .eq("status", "waiting_approval")
      .order("updated_at", { ascending: false })
      .limit(50);

    // Research runs that may need review (if status supports it)
    const { data: research } = await supabaseAdmin
      .from("research_runs")
      .select("id, topic, status, user_id, created_at, updated_at")
      .in("status", ["waiting_approval", "completed"])
      .order("updated_at", { ascending: false })
      .limit(30);

    // Knowledge entries still in sandbox / verified (candidates)
    const { data: knowledge } = await supabaseAdmin
      .from("knowledge_entries")
      .select("id, title, stage, confidence, owner_id, created_at, updated_at")
      .in("stage", ["sandbox", "verified"])
      .order("updated_at", { ascending: false })
      .limit(30);

    // Recent security-related audit events
    const { data: securityEvents } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, actor_id, target_type, target_id, metadata, created_at")
      .ilike("action", "%security%")
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      waitingTasks: waitingTasks ?? [],
      research: research ?? [],
      knowledgeCandidates: knowledge ?? [],
      securityEvents: securityEvents ?? [],
      totalPending:
        (waitingTasks?.length ?? 0) +
        (knowledge?.filter((k) => k.stage !== "production").length ?? 0),
    };
  });
