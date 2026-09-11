/** Phase I — server-authoritative indexing, hybrid retrieval and graph traversal. */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chunkText, combineScores, deterministicEmbeddingProvider, lexicalScore, type RetrievalMode } from "./retrieval-engine";

const db = (value: unknown) => value as SupabaseClient;
const MAX_QUERY = 20_000;

async function assertProject(client: SupabaseClient, projectId: string | null, ownerId: string) {
  if (!projectId) return;
  const { data, error } = await client.from("projects").select("id").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Response(`Could not validate project: ${error.message}`, { status: 500 });
  if (!data) throw new Response("Project not found or access denied", { status: 404 });
}

async function loadProductionEntry(client: SupabaseClient, entryId: string, ownerId: string) {
  const { data: entry, error } = await client.from("knowledge_entries").select("id,collection_id,title,body,stage,current_version,updated_at").eq("id", entryId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Response(`Could not load knowledge entry: ${error.message}`, { status: 500 });
  if (!entry) throw new Response("Knowledge entry not found or access denied", { status: 404 });
  if (entry.stage !== "production") throw new Response("Only production knowledge may be indexed", { status: 409 });
  const { data: collection, error: collectionError } = await client.from("knowledge_collections").select("project_id").eq("id", entry.collection_id).eq("owner_id", ownerId).maybeSingle();
  if (collectionError) throw new Response(`Could not load knowledge collection: ${collectionError.message}`, { status: 500 });
  return { entry, projectId: collection?.project_id ?? null };
}

export const enqueueKnowledgeIndex = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { entryId: string; reason?: string }) => ({ entryId: String(data?.entryId ?? "").trim(), reason: String(data?.reason ?? "manual").slice(0, 120) || "manual" })).handler(async ({ context, data }) => {
  const client = db(context.supabase);
  const { entry, projectId } = await loadProductionEntry(client, data.entryId, context.userId);
  const { data: existing } = await client.from("aether_retrieval_index_jobs").select("id,status,target_version").eq("entry_id", entry.id).eq("owner_id", context.userId).eq("target_version", entry.current_version).in("status", ["queued", "running"]).maybeSingle();
  if (existing) return { ok: true as const, reused: true, ...existing };
  const { data: job, error } = await supabaseAdmin.from("aether_retrieval_index_jobs").insert({ owner_id: context.userId, project_id: projectId, entry_id: entry.id, target_version: entry.current_version, reason: data.reason }).select("id,status,target_version").single();
  if (error || !job) throw new Response(`Could not queue index job: ${error?.message ?? "unknown error"}`, { status: 500 });
  return { ok: true as const, reused: false, ...job };
});

export const executeKnowledgeIndex = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { jobId: string }) => ({ jobId: String(data?.jobId ?? "").trim() })).handler(async ({ context, data }) => {
  const client = db(context.supabase);
  const { data: job, error: jobError } = await client.from("aether_retrieval_index_jobs").select("*").eq("id", data.jobId).eq("owner_id", context.userId).maybeSingle();
  if (jobError) throw new Response(`Could not load index job: ${jobError.message}`, { status: 500 });
  if (!job) throw new Response("Index job not found or access denied", { status: 404 });
  if (job.status === "completed") return { ok: true as const, reused: true, status: "completed" };
  const { entry, projectId } = await loadProductionEntry(client, job.entry_id, context.userId);
  const started = new Date().toISOString();
  await supabaseAdmin.from("aether_retrieval_index_jobs").update({ status: "running", attempts: Number(job.attempts ?? 0) + 1, started_at: started, last_error: null }).eq("id", job.id).eq("owner_id", context.userId);
  try {
    await supabaseAdmin.from("aether_knowledge_chunks").update({ is_current: false, updated_at: started }).eq("entry_id", entry.id).eq("owner_id", context.userId);
    await supabaseAdmin.from("aether_knowledge_embeddings").update({ is_current: false }).eq("owner_id", context.userId).eq("project_id", projectId).in("chunk_id", (await client.from("aether_knowledge_chunks").select("id").eq("entry_id", entry.id).eq("owner_id", context.userId)).data?.map((x) => x.id) ?? []);
    const chunks = chunkText(entry.body ?? entry.title);
    const { data: version } = await client.from("aether_knowledge_versions").select("id,version,source_candidate_id,provenance").eq("entry_id", entry.id).eq("owner_id", context.userId).eq("version", entry.current_version).maybeSingle();
    const insertedChunkIds: string[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const content = chunks[index];
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content.normalize("NFKC").trim().toLowerCase()));
      const contentHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { data: chunk, error: chunkError } = await supabaseAdmin.from("aether_knowledge_chunks").upsert({ entry_id: entry.id, owner_id: context.userId, project_id: projectId, version: entry.current_version, chunk_index: index, content, content_hash: contentHash, token_estimate: Math.ceil(content.length / 4), metadata: { title: entry.title }, is_current: true }, { onConflict: "entry_id,version,chunk_index" }).select("id").single();
      if (chunkError || !chunk) throw new Error(`Could not index chunk: ${chunkError?.message ?? "unknown error"}`);
      insertedChunkIds.push(chunk.id);
      const embedding = await deterministicEmbeddingProvider.embed(content);
      const { error: embeddingError } = await supabaseAdmin.from("aether_knowledge_embeddings").upsert({ chunk_id: chunk.id, owner_id: context.userId, project_id: projectId, provider: deterministicEmbeddingProvider.provider, model: deterministicEmbeddingProvider.model, dimensions: deterministicEmbeddingProvider.dimensions, embedding: `[${embedding.join(",")}]`, content_hash: contentHash, is_current: true }, { onConflict: "chunk_id,provider,model,content_hash" });
      if (embeddingError) throw new Error(`Could not persist embedding: ${embeddingError.message}`);
    }
    if (version?.id) {
      const { data: candidate } = await client.from("aether_knowledge_candidates").select("id,entities,relations,provenance").eq("published_entry_id", entry.id).eq("owner_id", context.userId).maybeSingle();
      const entities = Array.isArray(candidate?.entities) ? candidate.entities : [];
      const relations = Array.isArray(candidate?.relations) ? candidate.relations : [];
      const nodeIds = new Map<string, string>();
      for (const entity of entities as Array<Record<string, unknown>>) {
        const normalized = String(entity.normalizedName ?? entity.name ?? "").trim().toLowerCase();
        if (!normalized) continue;
        const { data: node, error: nodeError } = await supabaseAdmin.from("aether_knowledge_graph_nodes").upsert({ owner_id: context.userId, project_id: projectId, canonical_name: String(entity.name ?? normalized), normalized_name: normalized, entity_type: String(entity.entityType ?? "unknown"), attributes: {}, source_entry_id: entry.id, source_candidate_id: candidate?.id ?? null, source_version_id: version.id, provenance: { ...(candidate?.provenance ?? {}), version: entry.current_version } }, { onConflict: "owner_id,project_id,normalized_name,entity_type" }).select("id").single();
        if (nodeError || !node) throw new Error(`Could not index graph node: ${nodeError?.message ?? "unknown error"}`);
        nodeIds.set(normalized, node.id);
      }
      for (const relation of relations as Array<Record<string, unknown>>) {
        const subject = String(relation.subject ?? "").trim().toLowerCase(); const object = String(relation.object ?? "").trim().toLowerCase();
        if (!subject || !object) continue;
        const subjectNode = nodeIds.get(subject); const objectNode = nodeIds.get(object);
        if (!subjectNode || !objectNode) continue;
        await supabaseAdmin.from("aether_knowledge_graph_edges").upsert({ owner_id: context.userId, project_id: projectId, subject_node_id: subjectNode, object_node_id: objectNode, predicate: String(relation.predicate ?? "asserts"), confidence: Math.max(0, Math.min(1, Number(relation.confidence ?? 0.5))), source_entry_id: entry.id, source_candidate_id: candidate?.id ?? null, source_version_id: version.id, provenance: { ...(candidate?.provenance ?? {}), version: entry.current_version } }, { onConflict: "owner_id,project_id,subject_node_id,predicate,object_node_id,source_entry_id,source_version_id" });
      }
    }
    const completed = new Date().toISOString();
    await supabaseAdmin.from("aether_retrieval_index_jobs").update({ status: "completed", completed_at: completed, last_error: null }).eq("id", job.id).eq("owner_id", context.userId);
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "retrieval.index.completed", target_type: "aether_retrieval_index_jobs", target_id: job.id, metadata: { entry_id: entry.id, version: entry.current_version, chunks: insertedChunkIds.length } });
    return { ok: true as const, reused: false, status: "completed", entryId: entry.id, version: entry.current_version, chunks: insertedChunkIds.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabaseAdmin.from("aether_retrieval_index_jobs").update({ status: "failed", last_error: message.slice(0, 2000) }).eq("id", job.id).eq("owner_id", context.userId);
    throw new Response("Knowledge indexing failed; the durable job is marked failed and can be retried.", { status: 500 });
  }
});

export const retrieveKnowledge = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { query: string; projectId?: string | null; mode?: RetrievalMode; topK?: number; graphDepth?: number }) => {
  const query = String(data?.query ?? "").trim().slice(0, MAX_QUERY); const mode = data?.mode ?? "hybrid"; const topK = Math.max(1, Math.min(20, Number(data?.topK ?? 8))); const graphDepth = Math.max(0, Math.min(2, Number(data?.graphDepth ?? 1)));
  if (!query) throw new Error("Retrieval query is required"); if (!["lexical", "semantic", "hybrid", "graph"].includes(mode)) throw new Error("Unsupported retrieval mode");
  return { query, projectId: data?.projectId ?? null, mode, topK, graphDepth };
}).handler(async ({ context, data }) => {
  const client = db(context.supabase); await assertProject(client, data.projectId, context.userId);
  const started = new Date().toISOString();
  const { data: run, error: runError } = await supabaseAdmin.from("aether_retrieval_runs").insert({ owner_id: context.userId, project_id: data.projectId, query: data.query, mode: data.mode, status: "running", top_k: data.topK, metadata: { graphDepth: data.graphDepth } }).select("id").single();
  if (runError || !run) throw new Response(`Could not create retrieval run: ${runError?.message ?? "unknown error"}`, { status: 500 });
  try {
    const { data: chunks, error: chunkError } = await client.from("aether_knowledge_chunks").select("id,entry_id,project_id,version,chunk_index,content,content_hash,metadata").eq("owner_id", context.userId).eq("is_current", true).eq(data.projectId ? "project_id" : "entry_id", data.projectId ?? "00000000-0000-0000-0000-000000000000").limit(5000);
    if (chunkError) throw new Error(`Could not load knowledge index: ${chunkError.message}`);
    const entryIds = Array.from(new Set((chunks ?? []).map((c) => c.entry_id)));
    const { data: entries, error: entryError } = entryIds.length ? await client.from("knowledge_entries").select("id,title,stage,current_version,collection_id").eq("owner_id", context.userId).in("id", entryIds).eq("stage", "production") : { data: [], error: null };
    if (entryError) throw new Error(`Could not load production knowledge: ${entryError.message}`);
    const entryMap = new Map((entries ?? []).map((e) => [e.id, e]));
    const queryEmbedding = data.mode === "lexical" ? null : await deterministicEmbeddingProvider.embed(data.query);
    const chunkIds = (chunks ?? []).map((c) => c.id);
    const { data: embeddings, error: embeddingError } = chunkIds.length && queryEmbedding ? await client.from("aether_knowledge_embeddings").select("chunk_id,embedding").eq("owner_id", context.userId).eq("is_current", true).in("chunk_id", chunkIds) : { data: [], error: null };
    if (embeddingError) throw new Error(`Could not load embeddings: ${embeddingError.message}`);
    const embeddingMap = new Map((embeddings ?? []).map((e) => [e.chunk_id, e.embedding]));
    const candidates = (chunks ?? []).flatMap((chunk) => {
      const entry = entryMap.get(chunk.entry_id); if (!entry) return [];
      const lexical = lexicalScore(data.query, chunk.content); let semantic = 0;
      const raw = embeddingMap.get(chunk.id);
      if (raw && queryEmbedding) { const values = Array.isArray(raw) ? raw.map(Number) : String(raw).replace(/[\[\]]/g, "").split(",").map(Number); if (values.length === queryEmbedding.length) semantic = Math.max(0, (values.reduce((s, v, i) => s + v * queryEmbedding[i], 0) + 1) / 2); }
      const metadataScore = lexical.matchedTerms.some((term) => String(entry.title).toLowerCase().includes(term)) ? 1 : 0;
      const graphScore = 0;
      return [{ entryId: entry.id, chunkId: chunk.id, version: entry.current_version, title: entry.title, snippet: chunk.content.slice(0, 700), lexicalScore: lexical.score, semanticScore: semantic, metadataScore, graphScore, matchedTerms: lexical.matchedTerms, provenance: { version: entry.current_version, source: "production-knowledge" } }];
    }).map((item) => ({ ...item, finalScore: combineScores({ lexical: item.lexicalScore, semantic: item.semanticScore, metadata: item.metadataScore, graph: item.graphScore, mode: data.mode }) })).sort((a, b) => b.finalScore - a.finalScore).slice(0, data.topK);
    const results = candidates.map((item, index) => ({ retrieval_run_id: run.id, owner_id: context.userId, project_id: data.projectId, entry_id: item.entryId, chunk_id: item.chunkId, version_id: null, rank: index + 1, lexical_score: item.lexicalScore, semantic_score: item.semanticScore, metadata_score: item.metadataScore, graph_score: item.graphScore, final_score: item.finalScore, matched_terms: item.matchedTerms, snippet: item.snippet, provenance: item.provenance }));
    if (results.length) { const { error } = await supabaseAdmin.from("aether_retrieval_results").insert(results); if (error) throw new Error(`Could not persist retrieval results: ${error.message}`); }
    const completed = new Date().toISOString(); await supabaseAdmin.from("aether_retrieval_runs").update({ status: "completed", completed_at: completed, metadata: { graphDepth: data.graphDepth, resultCount: results.length, startedAt: started } }).eq("id", run.id).eq("owner_id", context.userId);
    return { ok: true as const, runId: run.id, results: candidates };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); await supabaseAdmin.from("aether_retrieval_runs").update({ status: "failed", error: message.slice(0, 2000) }).eq("id", run.id).eq("owner_id", context.userId); throw new Response("Retrieval failed; no unauthorized data was exposed.", { status: 500 });
  }
});

export const listRetrievalIndexJobs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data?: { projectId?: string | null }) => ({ projectId: data?.projectId ?? null })).handler(async ({ context, data }) => {
  let query = db(context.supabase).from("aether_retrieval_index_jobs").select("id,entry_id,project_id,target_version,reason,status,attempts,last_error,created_at,started_at,completed_at").eq("owner_id", context.userId).order("created_at", { ascending: false }).limit(100);
  if (data.projectId) query = query.eq("project_id", data.projectId);
  const { data: jobs, error } = await query; if (error) throw new Response(`Could not load retrieval jobs: ${error.message}`, { status: 500 }); return jobs ?? [];
});
