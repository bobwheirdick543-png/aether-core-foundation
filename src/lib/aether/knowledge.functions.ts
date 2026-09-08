/**
 * AETHER KNOWLEDGE SERVER FUNCTIONS
 * Administrator approval gates for candidate knowledge.
 * Never publishes without explicit approval.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canCuratorPublish, nextVersionNumber, buildChangeNote } from "./knowledge-pipeline";

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const listKnowledgeCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { data, error } = await context.supabase
      .from("knowledge_entries")
      .select("id, title, body, stage, confidence, tags, sources, owner_id, current_version, created_at, updated_at")
      .in("stage", ["sandbox", "verified"])
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const decideKnowledgeCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    entryId: string;
    decision: "approve" | "reject";
    reason?: string;
  }) => {
    if (!data?.entryId) throw new Error("entryId required");
    if (data.decision !== "approve" && data.decision !== "reject") {
      throw new Error("decision must be approve or reject");
    }
    return {
      entryId: String(data.entryId),
      decision: data.decision,
      reason: data.reason?.trim().slice(0, 500) || undefined,
    };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as unknown as SupabaseClient, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: entry, error: fetchErr } = await supabaseAdmin
      .from("knowledge_entries")
      .select("*")
      .eq("id", data.entryId)
      .single();

    if (fetchErr || !entry) throw new Error("Knowledge entry not found");

    if (entry.stage === "production") {
      return { ok: false as const, message: "Entry is already in production" };
    }

    if (data.decision === "reject") {
      await supabaseAdmin
        .from("knowledge_entries")
        .update({
          stage: "sandbox",
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.entryId);

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: context.userId,
        action: "knowledge.rejected",
        target_type: "knowledge_entries",
        target_id: data.entryId,
        metadata: { reason: data.reason ?? null },
      });

      return { ok: true as const, message: "Candidate rejected", stage: "sandbox" };
    }

    // APPROVE → move to approved then production via curator rules
    if (!canCuratorPublish("approved", true)) {
      return { ok: false as const, message: "Curator publish rules blocked this action" };
    }

    const newVersion = nextVersionNumber(entry.current_version);

    // Write version history
    await supabaseAdmin.from("knowledge_versions").insert({
      entry_id: data.entryId,
      owner_id: entry.owner_id,
      version: newVersion,
      body: entry.body,
      stage: "production",
      change_note: buildChangeNote("add", data.reason),
    });

    await supabaseAdmin
      .from("knowledge_entries")
      .update({
        stage: "production",
        current_version: newVersion,
        approved_by: context.userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.entryId);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "knowledge.approved",
      target_type: "knowledge_entries",
      target_id: data.entryId,
      metadata: { version: newVersion, reason: data.reason ?? null },
    });

    return { ok: true as const, message: "Candidate approved and published", stage: "production", version: newVersion };
  });
