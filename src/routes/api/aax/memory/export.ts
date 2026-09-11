import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/aax/memory/export")({
  server: {
    middleware: [requireSupabaseAuth],
    handlers: {
      GET: async ({ context }) => {
        const userId = (context as { userId: string }).userId;
        const [memoriesResult, candidatesResult, eventsResult] = await Promise.all([
          supabaseAdmin.from("aether_memories").select("id,project_id,scope,memory_type,content,status,persistence_mode,reason,confidence,importance,version,previous_memory_id,source_conversation_id,source_message_id,source_task_id,created_at,updated_at,last_used_at,deleted_at").eq("owner_id", userId).order("created_at", { ascending: true }),
          supabaseAdmin.from("aether_memory_candidates").select("id,project_id,scope,memory_type,content,status,reason,confidence,source_conversation_id,source_message_id,provenance,reviewed_by,reviewed_at,memory_id,created_at,updated_at").eq("owner_id", userId).order("created_at", { ascending: true }),
          supabaseAdmin.from("aether_memory_events").select("id,memory_id,candidate_id,event_type,actor_id,source_conversation_id,source_message_id,source_task_id,metadata,created_at").eq("owner_id", userId).order("created_at", { ascending: true }),
        ]);
        if (memoriesResult.error || candidatesResult.error || eventsResult.error) return new Response(JSON.stringify({ error: "Could not export Aether memory" }), { status: 500, headers: { "content-type": "application/json" } });
        await supabaseAdmin.from("aether_memory_events").insert({ owner_id: userId, event_type: "exported", metadata: { memory_count: memoriesResult.data?.length ?? 0, candidate_count: candidatesResult.data?.length ?? 0, event_count: eventsResult.data?.length ?? 0 } });
        const body = JSON.stringify({ exportedAt: new Date().toISOString(), schemaVersion: 1, memories: memoriesResult.data ?? [], candidates: candidatesResult.data ?? [], events: eventsResult.data ?? [] }, null, 2);
        return new Response(body, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="aether-memory-export-${new Date().toISOString().slice(0,10)}.json"`, "cache-control": "no-store" } });
      },
    },
  },
});
