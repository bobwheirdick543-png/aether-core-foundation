import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const untypedDb = (client: unknown) => client as any;

export const listProductionKnowledge = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data?: { projectId?: string }) => ({ projectId: data?.projectId ?? null })).handler(async ({ context, data }) => {
  const client = untypedDb(context.supabase);
  let query = client.from("knowledge_entries").select("id,collection_id,title,body,stage,confidence,sources,approved_by,approved_at,current_version,created_at,updated_at").eq("owner_id", context.userId).eq("stage", "production").order("updated_at", { ascending: false }).limit(200);
  if (data.projectId) {
    const { data: collections } = await client.from("knowledge_collections").select("id").eq("owner_id", context.userId).eq("project_id", data.projectId);
    const ids = (collections ?? []).map((row: any) => row.id);
    if (!ids.length) return [];
    query = query.in("collection_id", ids);
  }
  const { data: entries, error } = await query;
  if (error) throw new Response(`Could not load production knowledge: ${error.message}`, { status: 500 });
  return entries ?? [];
});

export const getProductionKnowledgeVersions = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data: { entryId: string }) => ({ entryId: String(data?.entryId ?? "").trim() })).handler(async ({ context, data }) => {
  const client = untypedDb(context.supabase);
  const { data: entry } = await client.from("knowledge_entries").select("id").eq("id", data.entryId).eq("owner_id", context.userId).maybeSingle();
  if (!entry) throw new Response("Knowledge entry not found or access denied", { status: 404 });
  const { data: versions, error } = await client.from("aether_knowledge_versions").select("id,entry_id,version,title,body,stage,change_type,change_note,source_candidate_id,provenance,actor_id,created_at").eq("entry_id", entry.id).eq("owner_id", context.userId).order("version", { ascending: false });
  if (error) throw new Response(`Could not load knowledge versions: ${error.message}`, { status: 500 });
  return versions ?? [];
});
