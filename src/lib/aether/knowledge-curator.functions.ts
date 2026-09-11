/** Phase H — server-authoritative acquisition, curation, publication and rollback. */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { canPublishCandidate, extractKnowledge, findConflicts, freshnessFromEvidence, mergeFreshness, normalizeKnowledgeText, type KnowledgeStatus, type FreshnessState } from "./knowledge-curator-engine";

const db = (value: unknown) => value as SupabaseClient;
const MAX_CONTENT = 200_000;
const MAX_BATCH = 50;

type CandidateRow = Record<string, any>;

async function assertProjectAccess(client: SupabaseClient, ownerId: string, projectId?: string | null) {
  if (!projectId) return;
  const { data, error } = await client.from("projects").select("id").eq("id", projectId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Response(`Could not verify project: ${error.message}`, { status: 500 });
  if (!data) throw new Response("Project not found or access denied", { status: 404 });
}

async function assertCandidate(client: SupabaseClient, ownerId: string, candidateId: string) {
  const { data, error } = await client.from("aether_knowledge_candidates").select("*").eq("id", candidateId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Response(`Could not load knowledge candidate: ${error.message}`, { status: 500 });
  if (!data) throw new Response("Knowledge candidate not found or access denied", { status: 404 });
  return data as CandidateRow;
}

async function audit(actorId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
  await supabaseAdmin.from("audit_logs").insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata });
}

async function createDurableTask(ownerId: string, projectId: string | null, title: string, kind: string, input: Record<string, unknown>) {
  const { data: task, error } = await supabaseAdmin.from("tasks").insert({ user_id: ownerId, project_id: projectId, title, kind, status: "queued", progress: 0, detail: input }).select("id").single();
  if (error || !task) throw new Response(`Could not create knowledge task: ${error?.message ?? "unknown error"}`, { status: 500 });
  const { data: run, error: runError } = await supabaseAdmin.from("task_runs").insert({ task_id: task.id, owner_id: ownerId, agent_key: "knowledge-acquisition", attempt: 1, status: "queued", inputs: input, outputs: {}, idempotency_key: `knowledge-h:${task.id}:1` }).select("id").single();
  if (runError || !run) throw new Response(`Could not create knowledge task run: ${runError?.message ?? "unknown error"}`, { status: 500 });
  return { taskId: task.id, runId: run.id };
}

async function buildCandidate(ownerId: string, projectId: string | null, input: { title?: string; content: string; verificationRunId?: string | null; sourceIds?: string[]; sourceMetadata?: unknown[]; provenance?: Record<string, unknown> }, existing: CandidateRow[]) {
  const extraction = await extractKnowledge(input.content);
  const conflicts = findConflicts({ normalizedContent: extraction.normalizedContent, claims: extraction.claims }, existing.map((row) => ({ id: row.id, normalizedContent: String(row.normalized_content ?? ""), claims: Array.isArray(row.claims) ? row.claims : [], status: row.status as KnowledgeStatus })));
  const sourceMetadata = Array.isArray(input.sourceMetadata) ? input.sourceMetadata : [];
  const freshnessStates = sourceMetadata.map((source: any) => freshnessFromEvidence({ retrievedAt: source.retrievedAt, publishedAt: source.publishedAt, staleAt: source.staleAt }));
  const freshness = mergeFreshness(freshnessStates.length ? freshnessStates : ["aging"]);
  const verificationStatus = input.verificationRunId ? "verified" : "pending";
  return {
    title: input.title?.trim().slice(0, 300) || extraction.title,
    content: input.content.slice(0, MAX_CONTENT),
    normalized_content: extraction.normalizedContent,
    content_hash: extraction.contentHash,
    status: conflicts.length ? "conflicted" : "needs_review",
    freshness_state: freshness,
    confidence: verificationStatus === "verified" ? 0.8 : 0.5,
    verification_status: verificationStatus,
    verification_run_id: input.verificationRunId ?? null,
    source_ids: Array.from(new Set((input.sourceIds ?? []).filter(Boolean))).slice(0, 100),
    source_metadata: sourceMetadata.slice(0, 100),
    claims: extraction.claims,
    entities: extraction.entities,
    relations: extraction.relations,
    conflicts,
    provenance: input.provenance ?? {},
    metadata: { extractor: "h1-deterministic", extractorVersion: "h1.0.0" },
    owner_id: ownerId,
    project_id: projectId,
  };
}

export const listKnowledgeCandidates = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data?: { projectId?: string; status?: string }) => ({ projectId: data?.projectId ?? null, status: data?.status ?? null })).handler(async ({ context, data }) => {
  let query = db(context.supabase).from("aether_knowledge_candidates").select("id,project_id,title,content,status,freshness_state,confidence,verification_status,verification_run_id,source_ids,claims,entities,relations,conflicts,provenance,metadata,reviewed_by,reviewed_at,published_entry_id,created_at,updated_at").eq("owner_id", context.userId).order("updated_at", { ascending: false }).limit(200);
  if (data.projectId) query = query.eq("project_id", data.projectId);
  if (data.status && data.status !== "all") query = query.eq("status", data.status);
  const { data: rows, error } = await query;
  if (error) throw new Response(`Could not load knowledge candidates: ${error.message}`, { status: 500 });
  return rows ?? [];
});

export const getKnowledgeCandidate = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((data: { candidateId: string }) => ({ candidateId: String(data?.candidateId ?? "").trim() })).handler(async ({ context, data }) => {
  const candidate = await assertCandidate(db(context.supabase), context.userId, data.candidateId);
  const [entities, relations, decisions, provenance] = await Promise.all([
    db(context.supabase).from("aether_knowledge_entities").select("*").eq("candidate_id", candidate.id).eq("owner_id", context.userId).order("created_at"),
    db(context.supabase).from("aether_knowledge_relations").select("*").eq("candidate_id", candidate.id).eq("owner_id", context.userId).order("created_at"),
    db(context.supabase).from("aether_knowledge_decisions").select("*").eq("candidate_id", candidate.id).eq("owner_id", context.userId).order("created_at", { ascending: false }),
    db(context.supabase).from("aether_knowledge_provenance").select("*").eq("candidate_id", candidate.id).eq("owner_id", context.userId).order("created_at", { ascending: false }),
  ]);
  return { candidate, entities: entities.data ?? [], relations: relations.data ?? [], decisions: decisions.data ?? [], provenance: provenance.data ?? [] };
});

export const acquireKnowledgeCandidate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { content: string; title?: string; projectId?: string; verificationRunId?: string; sourceIds?: string[]; sourceMetadata?: unknown[] }) => {
  const content = String(data?.content ?? "").trim();
  if (!content) throw new Error("Knowledge content is required");
  if (content.length > MAX_CONTENT) throw new Error(`Knowledge content exceeds ${MAX_CONTENT} characters`);
  return { ...data, content, title: data.title?.trim().slice(0, 300), projectId: data.projectId ?? null, verificationRunId: data.verificationRunId ?? null, sourceIds: data.sourceIds ?? [], sourceMetadata: data.sourceMetadata ?? [] };
}).handler(async ({ context, data }) => {
  const client = db(context.supabase);
  await assertProjectAccess(client, context.userId, data.projectId);
  if (data.verificationRunId) {
    const { data: run } = await client.from("verification_runs").select("id,status,project_id").eq("id", data.verificationRunId).eq("owner_id", context.userId).maybeSingle();
    if (!run) throw new Response("Verification run not found or access denied", { status: 404 });
    if (run.status !== "completed" && run.status !== "waiting_review") throw new Response("Knowledge acquisition requires a completed verification run", { status: 409 });
    if (run.project_id && data.projectId && run.project_id !== data.projectId) throw new Response("Verification run and project do not match", { status: 409 });
  }
  const durable = await createDurableTask(context.userId, data.projectId, data.title || "Acquire knowledge candidate", "knowledge", { operation: "acquire", verificationRunId: data.verificationRunId, contentHashSource: normalizeKnowledgeText(data.content).slice(0, 120) });
  const { data: existingRows } = await client.from("aether_knowledge_candidates").select("id,normalized_content,claims,status").eq("owner_id", context.userId).eq("project_id", data.projectId);
  const candidate = await buildCandidate(context.userId, data.projectId, data, existingRows ?? []);
  const { data: inserted, error } = await supabaseAdmin.from("aether_knowledge_candidates").insert(candidate).select("*").single();
  if (error || !inserted) {
    await supabaseAdmin.from("tasks").update({ status: "failed", last_error_code: "knowledge_acquisition_failed", last_error_message: error?.message ?? "unknown error" }).eq("id", durable.taskId);
    throw new Response(`Could not create knowledge candidate: ${error?.message ?? "unknown error"}`, { status: 500 });
  }
  const provenance = Array.from(new Set(candidate.source_ids)).map((sourceId) => ({ candidate_id: inserted.id, owner_id: context.userId, project_id: data.projectId, source_type: "research", source_id: sourceId, verification_run_id: data.verificationRunId, metadata: { acquisition: "phase-h" } }));
  if (provenance.length) await supabaseAdmin.from("aether_knowledge_provenance").insert(provenance);
  const entityRows = candidate.entities.map((entity: any) => ({ candidate_id: inserted.id, owner_id: context.userId, project_id: data.projectId, name: entity.name, normalized_name: entity.normalizedName, entity_type: entity.entityType, provenance: { extractor: "h1.0.0" } }));
  if (entityRows.length) await supabaseAdmin.from("aether_knowledge_entities").insert(entityRows);
  const relationRows = candidate.relations.map((relation: any) => ({ candidate_id: inserted.id, owner_id: context.userId, project_id: data.projectId, ...relation, provenance: { extractor: "h1.0.0" } }));
  if (relationRows.length) await supabaseAdmin.from("aether_knowledge_relations").insert(relationRows);
  await supabaseAdmin.from("aether_knowledge_decisions").insert({ candidate_id: inserted.id, owner_id: context.userId, actor_id: context.userId, decision: "edit", previous_status: null, new_status: inserted.status, reason: "Candidate acquired; curator review required.", metadata: { taskId: durable.taskId, runId: durable.runId } });
  const done = new Date().toISOString();
  await supabaseAdmin.from("task_runs").update({ status: "completed", ended_at: done, heartbeat_at: done, outputs: { candidateId: inserted.id, status: inserted.status } }).eq("id", durable.runId);
  await supabaseAdmin.from("tasks").update({ status: "completed", progress: 100, completed_at: done, heartbeat_at: done, detail: { operation: "acquire", candidateId: inserted.id, status: inserted.status } }).eq("id", durable.taskId);
  await audit(context.userId, "knowledge.candidate.acquired", "aether_knowledge_candidates", inserted.id, { taskId: durable.taskId, verificationRunId: data.verificationRunId });
  return { ok: true as const, candidate: inserted, taskId: durable.taskId, runId: durable.runId };
});

export const acquireKnowledgeFromVerificationRun = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { verificationRunId: string }) => ({ verificationRunId: String(data?.verificationRunId ?? "").trim() })).handler(async ({ context, data }) => {
  const client = db(context.supabase);
  const { data: run } = await client.from("verification_runs").select("id,owner_id,project_id,status").eq("id", data.verificationRunId).eq("owner_id", context.userId).maybeSingle();
  if (!run) throw new Response("Verification run not found or access denied", { status: 404 });
  if (run.status !== "completed") throw new Response("Only completed verification runs can seed knowledge acquisition", { status: 409 });
  const { data: claims, error } = await client.from("verification_claims").select("id,claim,verification_state,confidence,uncertainty,created_at").eq("verification_run_id", run.id).eq("owner_id", context.userId).order("created_at");
  if (error) throw new Response(`Could not load verified claims: ${error.message}`, { status: 500 });
  const verified = (claims ?? []).filter((claim: any) => claim.verification_state === "verified").slice(0, MAX_BATCH);
  if (!verified.length) throw new Response("The verification run contains no claims eligible for acquisition", { status: 409 });
  const durable = await createDurableTask(context.userId, run.project_id, "Acquire verified knowledge", "knowledge", { operation: "verification-batch", verificationRunId: run.id, claimCount: verified.length });
  const { data: existingRows } = await client.from("aether_knowledge_candidates").select("id,normalized_content,claims,status").eq("owner_id", context.userId).eq("project_id", run.project_id);
  const ids: string[] = [];
  for (const claim of verified) {
    const sourceData = await client.from("verification_evidence").select("id,source_id,source_url,source_title,published_at,retrieved_at,evidence_strength,authority_score,freshness_score").eq("claim_id", claim.id).eq("owner_id", context.userId).limit(20);
    const sourceRows = sourceData.data ?? [];
    const built = await buildCandidate(context.userId, run.project_id, { title: claim.claim.slice(0, 120), content: claim.claim, verificationRunId: run.id, sourceIds: sourceRows.map((row: any) => row.source_id).filter(Boolean), sourceMetadata: sourceRows, provenance: { verificationClaimId: claim.id, confidence: claim.confidence, uncertainty: claim.uncertainty } }, existingRows ?? []);
    const { data: inserted, error: insertError } = await supabaseAdmin.from("aether_knowledge_candidates").insert(built).select("id").single();
    if (insertError || !inserted) throw new Error(`Could not persist acquired claim: ${insertError?.message ?? "unknown error"}`);
    ids.push(inserted.id);
    await supabaseAdmin.from("aether_knowledge_provenance").insert(sourceRows.map((source: any) => ({ candidate_id: inserted.id, owner_id: context.userId, project_id: run.project_id, source_type: "research", source_id: source.source_id, source_url: source.source_url, verification_run_id: run.id, evidence_ids: [source.id], metadata: { verificationClaimId: claim.id } })));
  }
  const done = new Date().toISOString();
  await supabaseAdmin.from("task_runs").update({ status: "completed", ended_at: done, heartbeat_at: done, outputs: { candidateIds: ids, verificationRunId: run.id } }).eq("id", durable.runId);
  await supabaseAdmin.from("tasks").update({ status: "completed", progress: 100, completed_at: done, heartbeat_at: done, detail: { operation: "verification-batch", candidateIds: ids } }).eq("id", durable.taskId);
  await audit(context.userId, "knowledge.verification_acquired", "verification_runs", run.id, { candidateIds: ids });
  return { ok: true as const, candidateIds: ids, taskId: durable.taskId, runId: durable.runId };
});

export const curateKnowledgeCandidate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { candidateId: string; decision: "approve" | "reject" | "edit" | "request_verification"; reason?: string; title?: string; content?: string }) => {
  if (!data.candidateId?.trim()) throw new Error("Candidate id is required");
  return { ...data, candidateId: data.candidateId.trim(), reason: data.reason?.trim().slice(0, 2000) || null, title: data.title?.trim().slice(0, 300), content: data.content?.trim() };
}).handler(async ({ context, data }) => {
  const client = db(context.supabase);
  const current = await assertCandidate(client, context.userId, data.candidateId);
  if (["published", "superseded"].includes(current.status)) throw new Response("Published or superseded knowledge cannot be changed through candidate review", { status: 409 });
  let nextStatus: KnowledgeStatus = current.status;
  let patch: CandidateRow = { reviewed_by: context.userId, reviewed_at: new Date().toISOString() };
  if (data.decision === "approve") {
    if (current.verification_status !== "verified") throw new Response("Candidate must be verified before approval", { status: 409 });
    if (Array.isArray(current.conflicts) && current.conflicts.length) throw new Response("Resolve candidate conflicts before approval", { status: 409 });
    nextStatus = "approved";
  } else if (data.decision === "reject") nextStatus = "rejected";
  else if (data.decision === "request_verification") { nextStatus = "needs_review"; patch.verification_status = "needs_review"; }
  else if (data.decision === "edit") {
    if (!data.content) throw new Error("Edited content is required");
    const edited = await extractKnowledge(data.content);
    const { data: existing } = await client.from("aether_knowledge_candidates").select("id,normalized_content,claims,status").eq("owner_id", context.userId).eq("project_id", current.project_id).neq("id", current.id);
    const conflicts = findConflicts({ normalizedContent: edited.normalizedContent, claims: edited.claims }, (existing ?? []) as any);
    patch = { ...patch, title: data.title || edited.title, content: data.content.slice(0, MAX_CONTENT), normalized_content: edited.normalizedContent, content_hash: edited.contentHash, claims: edited.claims, entities: edited.entities, relations: edited.relations, conflicts, status: conflicts.length ? "conflicted" : "needs_review", metadata: { ...(current.metadata ?? {}), editedByCurator: true, extractorVersion: "h1.0.0" } };
    nextStatus = conflicts.length ? "conflicted" : "needs_review";
  }
  patch.status = nextStatus;
  const { data: updated, error } = await supabaseAdmin.from("aether_knowledge_candidates").update(patch).eq("id", current.id).eq("owner_id", context.userId).select("*").single();
  if (error || !updated) throw new Response(`Could not update candidate: ${error?.message ?? "unknown error"}`, { status: 500 });
  await supabaseAdmin.from("aether_knowledge_decisions").insert({ candidate_id: current.id, owner_id: context.userId, actor_id: context.userId, decision: data.decision, previous_status: current.status, new_status: nextStatus, reason: data.reason, metadata: { phase: "H" } });
  await audit(context.userId, `knowledge.candidate.${data.decision}`, "aether_knowledge_candidates", current.id, { previousStatus: current.status, newStatus: nextStatus });
  return { ok: true as const, candidate: updated };
});

export const publishKnowledgeCandidate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { candidateId: string; collectionId?: string }) => ({ candidateId: String(data?.candidateId ?? "").trim(), collectionId: data.collectionId ?? null })).handler(async ({ context, data }) => {
  const client = db(context.supabase);
  const candidate = await assertCandidate(client, context.userId, data.candidateId);
  const gate = canPublishCandidate({ status: candidate.status, verificationStatus: candidate.verification_status, conflicts: Array.isArray(candidate.conflicts) ? candidate.conflicts : [], freshness: candidate.freshness_state as FreshnessState });
  if (!gate.ok) throw new Response(gate.reason, { status: 409 });
  let collectionId = data.collectionId;
  if (collectionId) {
    const { data: collection } = await client.from("knowledge_collections").select("id").eq("id", collectionId).eq("owner_id", context.userId).maybeSingle();
    if (!collection) throw new Response("Knowledge collection not found or access denied", { status: 404 });
  } else {
    const { data: collection } = await client.from("knowledge_collections").select("id").eq("owner_id", context.userId).eq("project_id", candidate.project_id).eq("stage", "production").order("created_at").limit(1).maybeSingle();
    collectionId = collection?.id ?? null;
  }
  if (!collectionId) {
    const { data: collection, error } = await supabaseAdmin.from("knowledge_collections").insert({ owner_id: context.userId, project_id: candidate.project_id, name: "Aether Curated Knowledge", description: "Phase H governed production knowledge", stage: "production", tags: ["aether", "phase-h"] }).select("id").single();
    if (error || !collection) throw new Response(`Could not create production collection: ${error?.message ?? "unknown error"}`, { status: 500 });
    collectionId = collection.id;
  }
  const now = new Date().toISOString();
  const { data: entry, error: entryError } = await supabaseAdmin.from("knowledge_entries").insert({ collection_id: collectionId, owner_id: context.userId, title: candidate.title, body: candidate.content, stage: "production", confidence: candidate.confidence, tags: ["phase-h"], sources: candidate.source_metadata, current_version: 1, approved_by: context.userId, approved_at: now }).select("*").single();
  if (entryError || !entry) throw new Response(`Could not publish production knowledge: ${entryError?.message ?? "unknown error"}`, { status: 500 });
  const { error: versionError } = await supabaseAdmin.from("aether_knowledge_versions").insert({ entry_id: entry.id, owner_id: context.userId, version: 1, title: candidate.title, body: candidate.content, stage: "production", change_type: "published", change_note: "Initial Phase H publication", source_candidate_id: candidate.id, provenance: candidate.provenance, actor_id: context.userId });
  if (versionError) throw new Response(`Could not create knowledge version: ${versionError.message}`, { status: 500 });
  const { data: updated, error: candidateError } = await supabaseAdmin.from("aether_knowledge_candidates").update({ status: "published", published_entry_id: entry.id, reviewed_by: context.userId, reviewed_at: now }).eq("id", candidate.id).eq("owner_id", context.userId).select("*").single();
  if (candidateError || !updated) throw new Response(`Could not finalize candidate publication: ${candidateError?.message ?? "unknown error"}`, { status: 500 });
  await supabaseAdmin.from("aether_knowledge_decisions").insert({ candidate_id: candidate.id, entry_id: entry.id, owner_id: context.userId, actor_id: context.userId, decision: "publish", previous_status: candidate.status, new_status: "published", reason: "Explicit Phase H publication after approval gate.", metadata: { version: 1 } });
  await supabaseAdmin.from("aether_knowledge_provenance").insert({ candidate_id: candidate.id, entry_id: entry.id, owner_id: context.userId, source_type: "curated", verification_run_id: candidate.verification_run_id, evidence_ids: [], metadata: { publishedVersion: 1, candidateId: candidate.id } });
  await audit(context.userId, "knowledge.production.published", "knowledge_entries", entry.id, { candidateId: candidate.id, version: 1 });
  return { ok: true as const, entry, candidate: updated };
});

export const rollbackKnowledgeEntry = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { entryId: string; version: number; reason?: string }) => ({ entryId: String(data?.entryId ?? "").trim(), version: Number(data?.version), reason: data.reason?.trim().slice(0, 2000) || null })).handler(async ({ context, data }) => {
  if (!Number.isInteger(data.version) || data.version < 1) throw new Error("A valid knowledge version is required");
  const client = db(context.supabase);
  const { data: entry } = await client.from("knowledge_entries").select("*").eq("id", data.entryId).eq("owner_id", context.userId).maybeSingle();
  if (!entry) throw new Response("Knowledge entry not found or access denied", { status: 404 });
  const { data: target } = await client.from("aether_knowledge_versions").select("*").eq("entry_id", entry.id).eq("owner_id", context.userId).eq("version", data.version).maybeSingle();
  if (!target) throw new Response("Knowledge version not found", { status: 404 });
  const nextVersion = Number(entry.current_version ?? 1) + 1;
  const now = new Date().toISOString();
  const { error: versionError } = await supabaseAdmin.from("aether_knowledge_versions").insert({ entry_id: entry.id, owner_id: context.userId, version: nextVersion, title: target.title, body: target.body, stage: "production", change_type: "rollback", change_note: data.reason || `Rollback to version ${data.version}`, source_candidate_id: target.source_candidate_id, provenance: { rollbackFromVersion: entry.current_version, restoredVersion: data.version }, actor_id: context.userId });
  if (versionError) throw new Response(`Could not record rollback version: ${versionError.message}`, { status: 500 });
  const { data: updated, error } = await supabaseAdmin.from("knowledge_entries").update({ title: target.title, body: target.body, current_version: nextVersion, approved_by: context.userId, approved_at: now }).eq("id", entry.id).eq("owner_id", context.userId).select("*").single();
  if (error || !updated) throw new Response(`Could not apply knowledge rollback: ${error?.message ?? "unknown error"}`, { status: 500 });
  await supabaseAdmin.from("aether_knowledge_decisions").insert({ entry_id: entry.id, owner_id: context.userId, actor_id: context.userId, decision: "rollback", previous_status: entry.stage, new_status: "production", reason: data.reason, metadata: { restoredVersion: data.version, newVersion: nextVersion } });
  await audit(context.userId, "knowledge.production.rollback", "knowledge_entries", entry.id, { restoredVersion: data.version, newVersion: nextVersion });
  return { ok: true as const, entry: updated, restoredVersion: data.version, newVersion: nextVersion };
});

export const markKnowledgeCandidateOutdated = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { candidateId: string; reason?: string }) => ({ candidateId: String(data?.candidateId ?? "").trim(), reason: data.reason?.trim().slice(0, 2000) || "Source freshness requires review." })).handler(async ({ context, data }) => {
  const client = db(context.supabase);
  const current = await assertCandidate(client, context.userId, data.candidateId);
  if (current.status === "published") throw new Response("Published knowledge must be refreshed through a new candidate/version", { status: 409 });
  const { data: updated, error } = await supabaseAdmin.from("aether_knowledge_candidates").update({ status: "outdated", freshness_state: "stale" }).eq("id", current.id).eq("owner_id", context.userId).select("*").single();
  if (error || !updated) throw new Response(`Could not mark candidate outdated: ${error?.message ?? "unknown error"}`, { status: 500 });
  await supabaseAdmin.from("aether_knowledge_decisions").insert({ candidate_id: current.id, owner_id: context.userId, actor_id: context.userId, decision: "request_verification", previous_status: current.status, new_status: "outdated", reason: data.reason, metadata: { freshness: "stale" } });
  await audit(context.userId, "knowledge.candidate.outdated", "aether_knowledge_candidates", current.id, { reason: data.reason });
  return { ok: true as const, candidate: updated };
});
