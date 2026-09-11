/** Phase G — durable, owner-scoped verification workflow. */
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyClaims, type VerificationSource } from "./verification-engine";

const db = (value: unknown) => value as SupabaseClient;
const MAX_CLAIMS = 50;

async function assertOwnedSession(client: SupabaseClient, sessionId: string, ownerId: string) {
  const { data, error } = await client
    .from("aether_research_sessions")
    .select("id,owner_id,project_id,task_id,run_id,status,query")
    .eq("id", sessionId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Response(`Could not load research session: ${error.message}`, { status: 500 });
  if (!data) throw new Response("Research session not found or access denied", { status: 404 });
  if (data.project_id) {
    const { data: project } = await client.from("projects").select("id").eq("id", data.project_id).eq("owner_id", ownerId).maybeSingle();
    if (!project) throw new Response("Research project not found or access denied", { status: 404 });
  }
  return data;
}

async function loadSources(client: SupabaseClient, sessionId: string, ownerId: string): Promise<VerificationSource[]> {
  const { data, error } = await client
    .from("aether_research_sources")
    .select("id,url,title,domain,content,snippet,published_at,updated_at_source,retrieved_at,quality_score,quality_factors,stale_at")
    .eq("session_id", sessionId)
    .eq("owner_id", ownerId)
    .order("retrieved_at", { ascending: false });
  if (error) throw new Response(`Could not load research sources: ${error.message}`, { status: 500 });
  return (data ?? []) as VerificationSource[];
}

export const listMyVerificationRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { projectId?: string; sessionId?: string }) => ({ projectId: data?.projectId ?? null, sessionId: data?.sessionId ?? null }))
  .handler(async ({ context, data }) => {
    let query = db(context.supabase)
      .from("verification_runs")
      .select("id,project_id,research_session_id,task_id,run_id,status,verifier_version,summary,metrics,error,created_at,updated_at,completed_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.projectId) query = query.eq("project_id", data.projectId);
    if (data.sessionId) query = query.eq("research_session_id", data.sessionId);
    const { data: runs, error } = await query;
    if (error) throw new Response(`Could not load verification runs: ${error.message}`, { status: 500 });
    return runs ?? [];
  });

export const startVerificationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; claims: string[]; idempotencyKey?: string }) => {
    const sessionId = String(data?.sessionId ?? "").trim();
    const claims = Array.from(new Set((data?.claims ?? []).map((claim) => String(claim).trim()).filter(Boolean))).slice(0, MAX_CLAIMS);
    if (!sessionId) throw new Error("Research session id is required");
    if (!claims.length) throw new Error("At least one claim is required");
    return { sessionId, claims, idempotencyKey: data?.idempotencyKey?.trim().slice(0, 160) || null };
  })
  .handler(async ({ context, data }) => {
    const client = db(context.supabase);
    const session = await assertOwnedSession(client, data.sessionId, context.userId);
    if (data.idempotencyKey) {
      const { data: existing } = await client.from("verification_runs").select("id,status,task_id,run_id").eq("owner_id", context.userId).eq("idempotency_key", data.idempotencyKey).maybeSingle();
      if (existing) return { ok: true as const, reused: true, ...existing };
    }

    const { data: task, error: taskError } = await client
      .from("tasks")
      .insert({
        user_id: context.userId,
        title: `Verify research claims`,
        kind: "verification",
        status: "queued",
        progress: 0,
        detail: { researchSessionId: data.sessionId, claimCount: data.claims.length },
      })
      .select("id")
      .single();
    if (taskError || !task) throw new Response(`Could not create verification task: ${taskError?.message ?? "unknown error"}`, { status: 500 });

    const { data: taskRun, error: taskRunError } = await supabaseAdmin
      .from("task_runs")
      .insert({
        task_id: task.id,
        owner_id: context.userId,
        agent_key: "verification",
        attempt: 1,
        status: "queued",
        inputs: { research_session_id: data.sessionId, claims: data.claims },
        outputs: {},
        idempotency_key: `verification:${task.id}:attempt:1`,
      })
      .select("id")
      .single();
    if (taskRunError || !taskRun) throw new Response(`Could not create verification run: ${taskRunError?.message ?? "unknown error"}`, { status: 500 });

    const { data: verificationRun, error } = await client
      .from("verification_runs")
      .insert({
        owner_id: context.userId,
        project_id: session.project_id ?? null,
        research_session_id: session.id,
        task_id: task.id,
        run_id: taskRun.id,
        status: "queued",
        verifier_version: "g1.0.0",
        idempotency_key: data.idempotencyKey,
        metrics: { claimCount: data.claims.length },
      })
      .select("id,status,task_id,run_id,project_id,research_session_id,verifier_version")
      .single();
    if (error || !verificationRun) throw new Response(`Could not persist verification run: ${error?.message ?? "unknown error"}`, { status: 500 });

    await client.from("audit_logs").insert({
      actor_id: context.userId,
      action: "verification.queued",
      target_type: "verification_runs",
      target_id: verificationRun.id,
      metadata: { research_session_id: session.id, task_id: task.id, claim_count: data.claims.length },
    });
    return { ok: true as const, reused: false, ...verificationRun };
  });

export const executeVerificationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { verificationRunId: string }) => {
    const verificationRunId = String(data?.verificationRunId ?? "").trim();
    if (!verificationRunId) throw new Error("Verification run id is required");
    return { verificationRunId };
  })
  .handler(async ({ context, data }) => {
    const client = db(context.supabase);
    const { data: run, error: runError } = await client
      .from("verification_runs")
      .select("id,owner_id,project_id,research_session_id,task_id,run_id,status,verifier_version")
      .eq("id", data.verificationRunId)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (runError) throw new Response(`Could not load verification run: ${runError.message}`, { status: 500 });
    if (!run) throw new Response("Verification run not found or access denied", { status: 404 });
    if (!run.research_session_id) throw new Response("Verification run has no research session", { status: 409 });
    if (["completed", "cancelled"].includes(run.status)) return { ok: true as const, status: run.status, reused: true };

    const { data: inputRows, error: inputError } = await client.from("task_runs").select("inputs").eq("id", run.run_id).eq("owner_id", context.userId).maybeSingle();
    if (inputError || !inputRows) throw new Response("Verification inputs are unavailable", { status: 500 });
    const claims = Array.isArray((inputRows.inputs as Record<string, unknown>)?.claims) ? ((inputRows.inputs as Record<string, unknown>).claims as unknown[]).map(String).filter(Boolean).slice(0, MAX_CLAIMS) : [];
    if (!claims.length) throw new Response("Verification run contains no claims", { status: 409 });

    await client.from("verification_runs").update({ status: "running", updated_at: new Date().toISOString(), error: null }).eq("id", run.id).eq("owner_id", context.userId);
    if (run.task_id) {
      await client.from("tasks").update({ status: "running", progress: 10, started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", run.task_id).eq("user_id", context.userId);
      await supabaseAdmin.from("task_runs").update({ status: "running", started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", run.run_id).eq("owner_id", context.userId);
    }

    try {
      const sources = await loadSources(client, run.research_session_id, context.userId);
      const results = verifyClaims(claims, sources);
      const insertedClaims: string[] = [];
      for (const result of results) {
        const { data: claimRow, error: claimError } = await client
          .from("verification_claims")
          .insert({
            verification_run_id: run.id,
            owner_id: context.userId,
            claim: result.claim,
            normalized_claim: result.normalizedClaim,
            verification_state: result.verificationState,
            confidence: result.confidence,
            evidence_strength: result.evidenceStrength,
            authority_score: result.authorityScore,
            freshness_score: result.freshnessScore,
            uncertainty: result.uncertainty,
            contradiction_count: result.contradictionCount,
            date_mismatch_count: result.dateMismatchCount,
            missing_evidence: result.missingEvidence,
            requires_review: result.requiresReview,
            review_reason: result.reviewReason,
            metadata: { sourceCount: sources.length },
          })
          .select("id")
          .single();
        if (claimError || !claimRow) throw new Error(`Could not persist claim: ${claimError?.message ?? "unknown error"}`);
        insertedClaims.push(claimRow.id);
        if (result.evidence.length) {
          const evidenceRows = result.evidence.map((evidence) => ({
            claim_id: claimRow.id,
            owner_id: context.userId,
            source_id: evidence.sourceId,
            source_url: evidence.sourceUrl,
            source_title: evidence.sourceTitle,
            excerpt: evidence.excerpt,
            supports_claim: evidence.supportsClaim,
            evidence_strength: evidence.evidenceStrength,
            authority_score: evidence.authorityScore,
            freshness_score: evidence.freshnessScore,
            published_at: evidence.publishedAt,
            retrieved_at: evidence.retrievedAt,
            metadata: { reasons: evidence.reasons },
          }));
          const { error: evidenceError } = await client.from("verification_evidence").insert(evidenceRows);
          if (evidenceError) throw new Error(`Could not persist evidence: ${evidenceError.message}`);
        }
      }

      const counts = results.reduce<Record<string, number>>((acc, item) => { acc[item.verificationState] = (acc[item.verificationState] ?? 0) + 1; return acc; }, {});
      const needsReview = results.filter((item) => item.requiresReview).length;
      const completedAt = new Date().toISOString();
      const summary = `${results.length} claim${results.length === 1 ? "" : "s"} evaluated; ${needsReview} require review.`;
      const finalStatus = needsReview ? "waiting_review" : "completed";
      await client.from("verification_runs").update({ status: finalStatus, summary, metrics: { claimCount: results.length, sourceCount: sources.length, states: counts, needsReview }, completed_at: completedAt, updated_at: completedAt }).eq("id", run.id).eq("owner_id", context.userId);
      if (run.task_id) {
        await client.from("tasks").update({ status: finalStatus === "completed" ? "completed" : "waiting_approval", progress: 100, completed_at: completedAt, heartbeat_at: completedAt, detail: { verificationRunId: run.id, summary, states: counts } }).eq("id", run.task_id).eq("user_id", context.userId);
        await supabaseAdmin.from("task_runs").update({ status: finalStatus === "completed" ? "completed" : "waiting_approval", ended_at: completedAt, heartbeat_at: completedAt, outputs: { verificationRunId: run.id, claimIds: insertedClaims, states: counts } }).eq("id", run.run_id).eq("owner_id", context.userId);
        await supabaseAdmin.from("task_events").insert({ task_id: run.task_id, event_type: "verification.completed", message: summary, data: { verificationRunId: run.id, states: counts, sourceCount: sources.length }, actor_id: context.userId });
      }
      await client.from("audit_logs").insert({ actor_id: context.userId, action: "verification.completed", target_type: "verification_runs", target_id: run.id, metadata: { states: counts, source_count: sources.length } });
      return { ok: true as const, status: finalStatus, summary, metrics: { claimCount: results.length, sourceCount: sources.length, states: counts, needsReview }, reused: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedAt = new Date().toISOString();
      await client.from("verification_runs").update({ status: "failed", error: message.slice(0, 2000), updated_at: failedAt }).eq("id", run.id).eq("owner_id", context.userId);
      if (run.task_id) {
        await client.from("tasks").update({ status: "failed", last_error_code: "verification_failed", last_error_message: message.slice(0, 1000), heartbeat_at: failedAt }).eq("id", run.task_id).eq("user_id", context.userId);
        await supabaseAdmin.from("task_runs").update({ status: "failed", ended_at: failedAt, error: message.slice(0, 2000), failure_code: "verification_failed", retryable: true }).eq("id", run.run_id).eq("owner_id", context.userId);
        await supabaseAdmin.from("task_events").insert({ task_id: run.task_id, event_type: "verification.failed", message, data: { verificationRunId: run.id }, actor_id: context.userId });
      }
      await client.from("audit_logs").insert({ actor_id: context.userId, action: "verification.failed", target_type: "verification_runs", target_id: run.id, metadata: { error: message.slice(0, 500) } });
      throw new Response("Verification failed. The durable run has been marked failed and can be retried.", { status: 500 });
    }
  });

export const getMyVerificationRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { verificationRunId: string }) => ({ verificationRunId: String(data?.verificationRunId ?? "").trim() }))
  .handler(async ({ context, data }) => {
    const client = db(context.supabase);
    const { data: run, error } = await client.from("verification_runs").select("*").eq("id", data.verificationRunId).eq("owner_id", context.userId).maybeSingle();
    if (error) throw new Response(`Could not load verification run: ${error.message}`, { status: 500 });
    if (!run) throw new Response("Verification run not found or access denied", { status: 404 });
    const { data: claims, error: claimError } = await client.from("verification_claims").select("*").eq("verification_run_id", run.id).eq("owner_id", context.userId).order("created_at", { ascending: true });
    if (claimError) throw new Response(`Could not load verification claims: ${claimError.message}`, { status: 500 });
    const claimIds = (claims ?? []).map((claim) => claim.id);
    const { data: evidence, error: evidenceError } = claimIds.length ? await client.from("verification_evidence").select("*").eq("owner_id", context.userId).in("claim_id", claimIds).order("created_at", { ascending: true }) : { data: [], error: null };
    if (evidenceError) throw new Response(`Could not load verification evidence: ${evidenceError.message}`, { status: 500 });
    return { run, claims: claims ?? [], evidence: evidence ?? [] };
  });

export const reviewVerificationClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { claimId: string; decision: "accept" | "needs_review" | "reject" | "reverify"; reason?: string }) => ({ claimId: String(data?.claimId ?? "").trim(), decision: data.decision, reason: data.reason?.trim().slice(0, 2000) || null }))
  .handler(async ({ context, data }) => {
    const client = db(context.supabase);
    const { data: claim } = await client.from("verification_claims").select("id,verification_run_id,owner_id,verification_state").eq("id", data.claimId).eq("owner_id", context.userId).maybeSingle();
    if (!claim) throw new Response("Verification claim not found or access denied", { status: 404 });
    const previous = claim.verification_state;
    const next = data.decision === "accept" ? "verified" : data.decision === "reject" ? "rejected" : data.decision === "reverify" ? "pending" : "needs_review";
    const { error } = await client.from("verification_claims").update({ verification_state: next, requires_review: next !== "verified", review_reason: data.reason }).eq("id", claim.id).eq("owner_id", context.userId);
    if (error) throw new Response(`Could not update verification claim: ${error.message}`, { status: 500 });
    const { error: decisionError } = await client.from("verification_decisions").insert({ claim_id: claim.id, owner_id: context.userId, actor_id: context.userId, decision: data.decision, previous_state: previous, new_state: next, reason: data.reason });
    if (decisionError) throw new Response(`Could not persist review decision: ${decisionError.message}`, { status: 500 });
    await client.from("audit_logs").insert({ actor_id: context.userId, action: "verification.claim_reviewed", target_type: "verification_claims", target_id: claim.id, metadata: { decision: data.decision, previous_state: previous, new_state: next } });
    return { ok: true as const, claimId: claim.id, previousState: previous, newState: next };
  });

export const cancelVerificationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { verificationRunId: string; reason?: string }) => ({ verificationRunId: String(data?.verificationRunId ?? "").trim(), reason: data.reason?.trim().slice(0, 500) || "Cancelled by user" }))
  .handler(async ({ context, data }) => {
    const client = db(context.supabase);
    const now = new Date().toISOString();
    const { data: run } = await client.from("verification_runs").select("id,task_id,run_id,status").eq("id", data.verificationRunId).eq("owner_id", context.userId).maybeSingle();
    if (!run) throw new Response("Verification run not found or access denied", { status: 404 });
    if (["completed", "cancelled"].includes(run.status)) return { ok: true as const, status: run.status };
    await client.from("verification_runs").update({ status: "cancelled", error: data.reason, updated_at: now }).eq("id", run.id).eq("owner_id", context.userId);
    if (run.task_id) await client.from("tasks").update({ status: "cancelled", heartbeat_at: now, last_error_code: "cancelled", last_error_message: data.reason }).eq("id", run.task_id).eq("user_id", context.userId);
    if (run.run_id) await supabaseAdmin.from("task_runs").update({ status: "cancelled", ended_at: now, error: data.reason, cancel_requested_at: now, cancellation_reason: data.reason }).eq("id", run.run_id).eq("owner_id", context.userId);
    await client.from("audit_logs").insert({ actor_id: context.userId, action: "verification.cancelled", target_type: "verification_runs", target_id: run.id, metadata: { reason: data.reason } });
    return { ok: true as const, status: "cancelled" as const };
  });
