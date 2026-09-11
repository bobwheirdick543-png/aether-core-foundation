/** Phase I retrieval runtime. This is the active server boundary for RAG/index operations. */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chunkText, combineScores, deterministicEmbeddingProvider, lexicalScore, type RetrievalMode } from "./retrieval-engine";

const clientOf = (v: unknown) => v as SupabaseClient;
const sha256 = async (v: string) => { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)); return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join(""); };

async function ownedProject(client: SupabaseClient, projectId: string | null, ownerId: string) {
  if (!projectId) return;
  const { data, error } = await client.from("projects").select("id").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Response(`Could not validate project: ${error.message}`, { status: 500 });
  if (!data) throw new Response("Project not found or access denied", { status: 404 });
}

async function productionEntry(client: SupabaseClient, entryId: string, ownerId: string) {
  const { data: entry, error } = await client.from("knowledge_entries").select("id,collection_id,title,body,stage,current_version").eq("id", entryId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Response(`Could not load knowledge entry: ${error.message}`, { status: 500 });
  if (!entry) throw new Response("Knowledge entry not found or access denied", { status: 404 });
  if (entry.stage !== "production") throw new Response("Only production knowledge can be indexed", { status: 409 });
  const { data: collection, error: ce } = await client.from("knowledge_collections").select("project_id").eq("id", entry.collection_id).eq("owner_id", ownerId).maybeSingle();
  if (ce) throw new Response(`Could not load knowledge collection: ${ce.message}`, { status: 500 });
  return { entry, projectId: collection?.project_id ?? null };
}

export const queuePhaseIIndex = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { entryId: string; reason?: string }) => ({ entryId: String(d?.entryId ?? "").trim(), reason: String(d?.reason ?? "manual").trim().slice(0, 120) || "manual" })).handler(async ({ context, data }) => {
  const client = clientOf(context.supabase); const { entry, projectId } = await productionEntry(client, data.entryId, context.userId);
  const { data: active } = await client.from("aether_retrieval_index_jobs").select("id,status,target_version").eq("owner_id", context.userId).eq("entry_id", entry.id).eq("target_version", entry.current_version).in("status", ["queued", "running"]).maybeSingle();
  if (active) return { ok: true as const, reused: true, ...active };
  const { data: job, error } = await supabaseAdmin.from("aether_retrieval_index_jobs").insert({ owner_id: context.userId, project_id: projectId, entry_id: entry.id, target_version: entry.current_version, reason: data.reason }).select("id,status,target_version").single();
  if (error || !job) throw new Response(`Could not queue index job: ${error?.message ?? "unknown error"}`, { status: 500 });
  return { ok: true as const, reused: false, ...job };
});

export const runPhaseIIndex = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { jobId: string }) => ({ jobId: String(d?.jobId ?? "").trim() })).handler(async ({ context, data }) => {
  const client = clientOf(context.supabase); const { data: job, error: je } = await client.from("aether_retrieval_index_jobs").select("*").eq("id", data.jobId).eq("owner_id", context.userId).maybeSingle();
  if (je) throw new Response(`Could not load index job: ${je.message}`, { status: 500 }); if (!job) throw new Response("Index job not found or access denied", { status: 404 });
  if (job.status === "completed") return { ok: true as const, reused: true, status: "completed" };
  const { entry, projectId } = await productionEntry(client, job.entry_id, context.userId); const started = new Date().toISOString();
  await supabaseAdmin.from("aether_retrieval_index_jobs").update({ status: "running", attempts: Number(job.attempts ?? 0) + 1, started_at: started, last_error: null }).eq("id", job.id).eq("owner_id", context.userId);
  try {
    const { data: old } = await client.from("aether_knowledge_chunks").select("id").eq("owner_id", context.userId).eq("entry_id", entry.id);
    await supabaseAdmin.from("aether_knowledge_chunks").update({ is_current: false, updated_at: started }).eq("owner_id", context.userId).eq("entry_id", entry.id);
    if (old?.length) await supabaseAdmin.from("aether_knowledge_embeddings").update({ is_current: false }).eq("owner_id", context.userId).in("chunk_id", old.map((x) => x.id));
    const chunks = chunkText(entry.body ?? entry.title); const { data: version } = await client.from("aether_knowledge_versions").select("id,version,provenance").eq("owner_id", context.userId).eq("entry_id", entry.id).eq("version", entry.current_version).maybeSingle();
    for (let i = 0; i < chunks.length; i += 1) {
      const content = chunks[i]; const contentHash = await sha256(content.normalize("NFKC").trim().toLowerCase());
      const { data: chunk, error } = await supabaseAdmin.from("aether_knowledge_chunks").upsert({ entry_id: entry.id, owner_id: context.userId, project_id: projectId, version: entry.current_version, chunk_index: i, content, content_hash: contentHash, token_estimate: Math.ceil(content.length / 4), metadata: { title: entry.title }, is_current: true }, { onConflict: "entry_id,version,chunk_index" }).select("id").single();
      if (error || !chunk) throw new Error(`Could not persist chunk: ${error?.message ?? "unknown error"}`);
      const embedding = await deterministicEmbeddingProvider.embed(content);
      const { error: embError } = await supabaseAdmin.from("aether_knowledge_embeddings").upsert({ chunk_id: chunk.id, owner_id: context.userId, project_id: projectId, provider: deterministicEmbeddingProvider.provider, model: deterministicEmbeddingProvider.model, dimensions: deterministicEmbeddingProvider.dimensions, embedding: `[${embedding.join(",")}]`, content_hash: contentHash, is_current: true }, { onConflict: "chunk_id,provider,model,content_hash" });
      if (embError) throw new Error(`Could not persist embedding: ${embError.message}`);
    }
    const { data: candidate } = await client.from("aether_knowledge_candidates").select("id,entities,relations,provenance").eq("owner_id", context.userId).eq("published_entry_id", entry.id).maybeSingle();
    if (version?.id && candidate) {
      const nodeIds = new Map<string, string>();
      for (const entity of (Array.isArray(candidate.entities) ? candidate.entities : []) as Array<Record<string, unknown>>) {
        const name = String(entity.name ?? entity.normalizedName ?? "").trim(), normalized = String(entity.normalizedName ?? name).trim().toLowerCase(); if (!normalized) continue;
        const { data: node, error } = await supabaseAdmin.from("aether_knowledge_graph_nodes").upsert({ owner_id: context.userId, project_id: projectId, canonical_name: name || normalized, normalized_name: normalized, entity_type: String(entity.entityType ?? "unknown"), source_entry_id: entry.id, source_candidate_id: candidate.id, source_version_id: version.id, provenance: { ...(candidate.provenance ?? {}), version: entry.current_version } }, { onConflict: "owner_id,project_id,normalized_name,entity_type" }).select("id").single();
        if (error || !node) throw new Error(`Could not persist graph node: ${error?.message ?? "unknown error"}`); nodeIds.set(normalized, node.id);
      }
      for (const relation of (Array.isArray(candidate.relations) ? candidate.relations : []) as Array<Record<string, unknown>>) {
        const s = String(relation.subject ?? "").trim().toLowerCase(), o = String(relation.object ?? "").trim().toLowerCase(); const sn = nodeIds.get(s), on = nodeIds.get(o); if (!sn || !on) continue;
        const { error } = await supabaseAdmin.from("aether_knowledge_graph_edges").upsert({ owner_id: context.userId, project_id: projectId, subject_node_id: sn, object_node_id: on, predicate: String(relation.predicate ?? "asserts"), confidence: Math.max(0, Math.min(1, Number(relation.confidence ?? 0.5))), source_entry_id: entry.id, source_candidate_id: candidate.id, source_version_id: version.id, provenance: { version: entry.current_version } }, { onConflict: "owner_id,project_id,subject_node_id,predicate,object_node_id,source_entry_id,source_version_id" });
        if (error) throw new Error(`Could not persist graph edge: ${error.message}`);
      }
    }
    const completed = new Date().toISOString(); await supabaseAdmin.from("aether_retrieval_index_jobs").update({ status: "completed", completed_at: completed }).eq("id", job.id).eq("owner_id", context.userId);
    return { ok: true as const, reused: false, status: "completed", chunks: chunks.length, version: entry.current_version };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); await supabaseAdmin.from("aether_retrieval_index_jobs").update({ status: "failed", last_error: message.slice(0, 2000) }).eq("id", job.id).eq("owner_id", context.userId); throw new Response("Knowledge indexing failed; the durable job remains retryable.", { status: 500 });
  }
});

export const retrievePhaseI = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { query: string; projectId?: string | null; mode?: RetrievalMode; topK?: number }) => { const query = String(d?.query ?? "").trim().slice(0, 20000), mode = d?.mode ?? "hybrid", topK = Math.max(1, Math.min(20, Number(d?.topK ?? 8))); if (!query) throw new Error("Retrieval query is required"); if (!["lexical", "semantic", "hybrid", "graph"].includes(mode)) throw new Error("Unsupported retrieval mode"); return { query, projectId: d?.projectId ?? null, mode, topK }; }).handler(async ({ context, data }) => {
  const client = clientOf(context.supabase); await ownedProject(client, data.projectId, context.userId);
  const { data: run, error: re } = await supabaseAdmin.from("aether_retrieval_runs").insert({ owner_id: context.userId, project_id: data.projectId, query: data.query, mode: data.mode, status: "running", top_k: data.topK }).select("id").single();
  if (re || !run) throw new Response(`Could not create retrieval run: ${re?.message ?? "unknown error"}`, { status: 500 });
  try {
    let q = client.from("aether_knowledge_chunks").select("id,entry_id,project_id,version,content,metadata").eq("owner_id", context.userId).eq("is_current", true); if (data.projectId) q = q.eq("project_id", data.projectId); const { data: chunks, error } = await q.limit(5000); if (error) throw new Error(error.message);
    const entryIds = Array.from(new Set((chunks ?? []).map((x) => x.entry_id))); const { data: entries, error: ee } = entryIds.length ? await client.from("knowledge_entries").select("id,title,stage,current_version").eq("owner_id", context.userId).eq("stage", "production").in("id", entryIds) : { data: [], error: null }; if (ee) throw new Error(ee.message);
    const entriesById = new Map((entries ?? []).map((x) => [x.id, x])); const chunkIds = (chunks ?? []).map((x) => x.id); const { data: em } = chunkIds.length && data.mode !== "lexical" ? await client.from("aether_knowledge_embeddings").select("chunk_id,embedding").eq("owner_id", context.userId).eq("is_current", true).in("chunk_id", chunkIds) : { data: [] }; const embeddings = new Map((em ?? []).map((x) => [x.chunk_id, x.embedding]));
    const { data: nodes } = await client.from("aether_knowledge_graph_nodes").select("id,normalized_name,source_entry_id").eq("owner_id", context.userId).limit(1000); const terms = new Set(data.query.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]{2,}/gu) ?? []); const nodeIds = (nodes ?? []).filter((n) => Array.from(terms).some((t) => String(n.normalized_name).includes(t))).map((n) => n.id); const { data: edges } = nodeIds.length ? await client.from("aether_knowledge_graph_edges").select("source_entry_id,confidence").eq("owner_id", context.userId).in("subject_node_id", nodeIds).limit(1000) : { data: [] }; const graph = new Map<string, number>(); for (const e of edges ?? []) if (e.source_entry_id) graph.set(e.source_entry_id, Math.max(graph.get(e.source_entry_id) ?? 0, Number(e.confidence ?? 0.5)));
    const queryEmbedding = data.mode === "lexical" ? null : await deterministicEmbeddingProvider.embed(data.query);
    const ranked = (chunks ?? []).flatMap((chunk) => { const entry = entriesById.get(chunk.entry_id); if (!entry) return []; const lex = lexicalScore(data.query, chunk.content); let sem = 0; const raw = embeddings.get(chunk.id); if (raw && queryEmbedding) { const vals = Array.isArray(raw) ? raw.map(Number) : String(raw).replace(/[\[\]]/g, "").split(",").map(Number); if (vals.length === queryEmbedding.length) sem = Math.max(0, (vals.reduce((s, v, i) => s + v * queryEmbedding[i], 0) + 1) / 2); } const meta = lex.matchedTerms.some((t) => String(entry.title).toLowerCase().includes(t)) ? 1 : 0; const g = graph.get(entry.id) ?? 0; const score = combineScores({ lexical: lex.score, semantic: sem, metadata: meta, graph: g, mode: data.mode }); return [{ entryId: entry.id, chunkId: chunk.id, version: entry.current_version, title: entry.title, snippet: chunk.content.slice(0, 700), lexicalScore: lex.score, semanticScore: sem, metadataScore: meta, graphScore: g, finalScore: score, matchedTerms: lex.matchedTerms, provenance: { source: "production-knowledge", version: entry.current_version } }]; }).sort((a, b) => b.finalScore - a.finalScore).slice(0, data.topK);
    const resultRows = ranked.map((r, i) => ({ retrieval_run_id: run.id, owner_id: context.userId, project_id: data.projectId, entry_id: r.entryId, chunk_id: r.chunkId, rank: i + 1, lexical_score: r.lexicalScore, semantic_score: r.semanticScore, metadata_score: r.metadataScore, graph_score: r.graphScore, final_score: r.finalScore, matched_terms: r.matchedTerms, snippet: r.snippet, provenance: r.provenance })); if (resultRows.length) { const { error: ins } = await supabaseAdmin.from("aether_retrieval_results").insert(resultRows); if (ins) throw new Error(ins.message); }
    await supabaseAdmin.from("aether_retrieval_runs").update({ status: "completed", completed_at: new Date().toISOString(), metadata: { resultCount: ranked.length } }).eq("id", run.id).eq("owner_id", context.userId); return { ok: true as const, runId: run.id, results: ranked.map((r, i) => ({ ...r, rank: i + 1 })) };
  } catch (error) { const message = error instanceof Error ? error.message : String(error); await supabaseAdmin.from("aether_retrieval_runs").update({ status: "failed", error: message.slice(0, 2000) }).eq("id", run.id).eq("owner_id", context.userId); throw new Response("Retrieval failed; no unauthorized data was exposed.", { status: 500 }); }
});

export const listPhaseIIndexJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d?: { projectId?: string | null }) => ({ projectId: d?.projectId ?? null })).handler(async ({ context, data }) => { let q = clientOf(context.supabase).from("aether_retrieval_index_jobs").select("id,entry_id,project_id,target_version,reason,status,attempts,last_error,created_at,started_at,completed_at").eq("owner_id", context.userId).order("created_at", { ascending: false }).limit(100); if (data.projectId) q = q.eq("project_id", data.projectId); const { data: jobs, error } = await q; if (error) throw new Response(`Could not load index jobs: ${error.message}`, { status: 500 }); return jobs ?? []; });
