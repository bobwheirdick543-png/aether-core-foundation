import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const exportAetherMemory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const ownerId = context.userId;
  const [memoriesResult, candidatesResult, eventsResult] = await Promise.all([
    supabaseAdmin.from("aether_memories").select("id,project_id,scope,memory_type,content,status,persistence_mode,reason,confidence,importance,version,previous_memory_id,source_conversation_id,source_message_id,source_task_id,created_at,updated_at,last_used_at,deleted_at").eq("owner_id", ownerId).order("created_at", { ascending: true }),
    supabaseAdmin.from("aether_memory_candidates").select("id,project_id,scope,memory_type,content,status,reason,confidence,source_conversation_id,source_message_id,provenance,reviewed_by,reviewed_at,memory_id,created_at,updated_at").eq("owner_id", ownerId).order("created_at", { ascending: true }),
    supabaseAdmin.from("aether_memory_events").select("id,memory_id,candidate_id,event_type,actor_id,source_conversation_id,source_message_id,source_task_id,metadata,created_at").eq("owner_id", ownerId).order("created_at", { ascending: true }),
  ]);
  if (memoriesResult.error || candidatesResult.error || eventsResult.error) throw new Response("Could not export Aether memory", { status: 500 });
  await supabaseAdmin.from("aether_memory_events").insert({ owner_id: ownerId, event_type: "exported", metadata: { memory_count: memoriesResult.data?.length ?? 0, candidate_count: candidatesResult.data?.length ?? 0, event_count: eventsResult.data?.length ?? 0 } });
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), memories: memoriesResult.data ?? [], candidates: candidatesResult.data ?? [], events: eventsResult.data ?? [] };
});
