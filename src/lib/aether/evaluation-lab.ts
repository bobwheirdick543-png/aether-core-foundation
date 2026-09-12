import type { SupabaseClient } from "@supabase/supabase-js";
import { AGENTS } from "./agents";
import { buildWorkflowSteps, classifyIntent, validateOrchestrationPlan } from "./orchestrator";
import { retrievePage, isHttpUrl, domainFromUrl } from "./research-engine";
import { verifyClaim, type VerificationSource } from "./verification-engine";
import { buildReportPdf, buildReportDataFingerprint, type ReportData } from "./report-engine";
import { validateModuleManifest, validateModuleVersion, assertModuleDependenciesAcyclic, registeredModuleSlugs } from "./module-runtime";
import { appendUnderstanding, buildDownstreamContext, AAX_KNOWLEDGE_FLOW, type AaxKnowledgePackage, type UnderstandingArtifact } from "./aax-knowledge-evolution";

export const EVALUATION_TARGETS = ["agents","orchestrator","research","verification","knowledge","reports","notifications","modules","battle-versia"] as const;
export type EvaluationTarget = (typeof EVALUATION_TARGETS)[number];
function safeText(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }
function expectedScore(actual: unknown, expected: Record<string, unknown>) { const required = Array.isArray(expected.requiredFields) ? expected.requiredFields.map(String) : []; if (required.length) { const object = (actual ?? {}) as Record<string, unknown>; const missing = required.filter((field) => !(field in object)); return { score: missing.length ? Math.max(0, 1 - missing.length / required.length) : 1, missing }; } if (typeof expected.contains === "string") { const haystack = JSON.stringify(actual).toLowerCase(); const needle = expected.contains.toLowerCase(); return { score: haystack.includes(needle) ? 1 : 0, missing: haystack.includes(needle) ? [] : [expected.contains] }; } return { score: 1, missing: [] as string[] }; }

async function executeTarget(target: EvaluationTarget, input: Record<string, unknown>, db: SupabaseClient) {
  if (target === "orchestrator") { const request = safeText(input.request ?? input.prompt ?? input.message); if (!request) throw new Error("Orchestrator evaluation requires a request"); const plan = classifyIntent(request); validateOrchestrationPlan(plan); const taskId = safeText(input.taskId, 120) || `evaluation:${crypto.randomUUID()}`; const workflow = buildWorkflowSteps(plan, taskId); return { adapter: "orchestrator.runtime", executed: true, intent: plan.intent, capabilities: plan.capabilities, agents: plan.agents, riskLevel: plan.riskLevel, approvalRequired: plan.approvalRequired, workflow }; }
  if (target === "agents") { const requested = safeText(input.agentKey, 80); const agents = requested ? AGENTS.filter((agent) => agent.key === requested) : AGENTS; if (!agents.length) throw new Error(`Unknown agent: ${requested}`); return { adapter: "agent.registry", executed: true, agents: agents.map((agent) => ({ key: agent.key, name: agent.name, status: agent.status, tools: agent.tools, prohibited: agent.prohibited, permissionCount: agent.permissions.length })) }; }

  if (target === "research") {
    const url = safeText(input.url, 2000) || "https://example.com";
    if (!isHttpUrl(url)) throw new Error("Research evaluation URL must be a public http/https URL");
    const page = await retrievePage(url, { timeoutMs: 15_000, maxBytes: 2_000_000, maxRedirects: 5, maxRetries: 2, respectRobots: true, staleAfterDays: 30 });
    if (page.error || page.status >= 400 || !page.text) throw new Error(page.error || `Research retrieval failed with status ${page.status}`);
    return { adapter: "research.runtime", executed: true, url: page.url, finalUrl: page.finalUrl, domain: domainFromUrl(page.finalUrl), status: page.status, title: page.title, contentHash: page.contentHash, contentLength: page.contentLength ?? page.text.length, attempts: page.attempts ?? 1, redirectCount: page.redirectCount ?? 0, robotsAllowed: page.robotsAllowed ?? true, stale: page.stale ?? false, parserVersion: page.parserVersion ?? null };
  }

  if (target === "verification") {
    const claim = safeText(input.claim) || "Aether is an AI platform";
    const sources = (Array.isArray(input.sources) ? input.sources : [{ id: "evaluation-source", title: "Evaluation evidence", domain: "example.org", content: claim, retrievedAt: new Date().toISOString() }]) as VerificationSource[];
    const result = verifyClaim(claim, sources);
    return { adapter: "verification.runtime", executed: true, verificationState: result.verificationState, confidence: result.confidence, evidenceStrength: result.evidenceStrength, authorityScore: result.authorityScore, freshnessScore: result.freshnessScore, contradictionCount: result.contradictionCount, dateMismatchCount: result.dateMismatchCount, requiresReview: result.requiresReview, evidenceCount: result.evidence.length };
  }

  if (target === "knowledge") {
    const now = new Date().toISOString();
    const artifact: UnderstandingArtifact = { understandingId: `evaluation:${crypto.randomUUID()}`, agentKey: "knowledge-acquisition", trainingJobId: safeText(input.trainingJobId, 120) || "evaluation", targetModelId: safeText(input.targetModelId, 120) || "aax", parentUnderstandingIds: [], sequence: 1, interpretation: safeText(input.interpretation) || "Evaluation understanding", concepts: ["evaluation"], definitions: [], relationships: [], context: [], newKnowledge: [safeText(input.knowledge) || "Evaluation knowledge"], existingKnowledgeLinks: [], corrections: [], contradictions: [], uncertainties: [], crossDomainConnections: [], reasoning: ["Generated by the governed knowledge contract evaluator."], evidence: ["evaluation"], confidence: 1, recommendedKnowledgeChanges: [] };
    const pkg: AaxKnowledgePackage = { trainingJobId: artifact.trainingJobId, targetModelId: artifact.targetModelId, originalSource: { sourceType: "evaluation", reference: { createdAt: now } }, rawExtractedContent: artifact.interpretation, understandings: [], evidence: artifact.evidence, knowledgeChanges: { newKnowledge: [], reinforcedKnowledge: [], correctedKnowledge: [], contradictedKnowledge: [], newRelationships: [] }, existingAaxKnowledge: [] };
    const appended = appendUnderstanding(pkg, artifact); const downstream = buildDownstreamContext(appended);
    return { adapter: "knowledge.evolution.runtime", executed: true, flow: AAX_KNOWLEDGE_FLOW, understandingCount: downstream.understandings.length, knowledgeChangeKeys: Object.keys(downstream.knowledgeChanges), governed: true };
  }

  if (target === "reports") {
    const data: ReportData = { title: safeText(input.title, 160) || "Evaluation Report", topic: safeText(input.topic, 500) || "Phase V", sessionId: safeText(input.sessionId, 120) || null, runId: safeText(input.runId, 120) || null, generatedAt: new Date().toISOString(), verificationStatus: "verified", approvalStatus: "approved", version: Math.max(1, Math.floor(Number(input.version ?? 1))), sources: [], verifiedFindings: [{ claim: "Evaluation report generation is operational", evidence: "Generated by the existing deterministic report engine", verificationStatus: "verified", confidence: 1 }], unresolvedClaims: [] };
    const pdf = buildReportPdf(data); if (!pdf.length || new TextDecoder().decode(pdf.slice(0, 8)) !== "%PDF-1.4") throw new Error("Report engine did not produce a valid PDF header");
    return { adapter: "report.runtime", executed: true, pdfBytes: pdf.length, fingerprint: buildReportDataFingerprint(data), version: data.version, verificationStatus: data.verificationStatus, approvalStatus: data.approvalStatus };
  }

  if (target === "notifications") {
    const recipientId = safeText(input.recipientId, 80);
    if (!recipientId) throw new Error("Notification evaluation requires recipientId");
    const { data: row, error } = await (db as SupabaseClient<any>).from("notifications").insert({ recipient_id: recipientId, audience: "user", event_type: "evaluation.phase_v", title: "Evaluation Lab test", body: "Phase V notification adapter execution.", resource_type: "evaluation_runs", resource_id: safeText(input.runId, 80) || null, link: "/evaluation-lab", status: "delivered", delivered_at: new Date().toISOString() }).select("id,event_type,status,recipient_id").single();
    if (error || !row) throw new Error(error?.message || "Notification adapter failed to persist delivery");
    return { adapter: "notification.runtime", executed: true, notificationId: row.id, eventType: row.event_type, status: row.status, recipientId: row.recipient_id, durable: true };
  }

  if (target === "modules") {
    const manifest = (input.manifest && typeof input.manifest === "object" ? input.manifest : { apiVersion: "aether.module/v1", slug: "evaluation-module", name: "Evaluation Module", description: "Trusted evaluation module", kind: "tool", entrypoint: "evaluation", capabilities: ["evaluation.read"], dependencies: [], inputs: ["input"], outputs: ["output"], configurationSchema: {}, prohibited: ["Bypass authorization"] }) as Record<string, unknown>;
    const manifestErrors = validateModuleManifest(manifest); const version = safeText(input.version, 40) || "1.0.0"; const versionErrors = validateModuleVersion(version); const slug = safeText(manifest.slug, 80) || "evaluation-module"; assertModuleDependenciesAcyclic(slug, (input.dependencies && typeof input.dependencies === "object" ? input.dependencies : { [slug]: [] }) as Record<string, string[]>);
    if (manifestErrors.length || versionErrors.length) throw new Error(`Module contract invalid: ${[...manifestErrors, ...versionErrors].join("; ")}`);
    return { adapter: "module.runtime", executed: true, manifestValid: true, versionValid: true, version, registeredHandlers: registeredModuleSlugs() };
  }

  if (target === "battle-versia") {
    const dbAny = db as SupabaseClient<any>;
    const [{ data: characters, error: ce }, { data: auctions, error: ae }, { data: tournaments, error: te }, { data: servers, error: se }] = await Promise.all([dbAny.from("bv_characters").select("id,slug,name,universe,power_score,price,market_available").eq("active", true).limit(12), dbAny.from("bv_auctions").select("id,status,mode,fund").in("status", ["lobby", "active", "paused"]).limit(10), dbAny.from("bv_tournaments").select("id,status,name,max_players").in("status", ["registration", "active", "paused"]).limit(10), dbAny.from("bv_servers").select("id,name,status").limit(10)]);
    const error = ce || ae || te || se; if (error) throw new Error(`Battleversia evaluation failed: ${error.message}`);
    return { adapter: "battleversia.runtime", executed: true, characters: characters?.length ?? 0, liveAuctions: auctions?.length ?? 0, tournaments: tournaments?.length ?? 0, servers: servers?.length ?? 0, persistent: true };
  }
  throw new Error(`No evaluation adapter registered for ${target}`);
}

export async function executeEvaluationRun(db: SupabaseClient, runId: string, target: EvaluationTarget, input: Record<string, unknown>, expected: Record<string, unknown>) {
  const started = Date.now();
  await db.from("evaluation_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", runId);
  await db.from("evaluation_run_events").insert({ run_id: runId, event_type: "started", stage: "evaluation", payload: { target } });
  try { const actual = await executeTarget(target, input, db); const scored = expectedScore(actual, expected); const latencyMs = Date.now() - started; const passed = scored.score >= Number(expected.minimumScore ?? 1); const trace = [{ stage: "execution", status: "completed", adapter: actual.adapter, at: new Date().toISOString() }]; const approvalRequired = Boolean((actual as { approvalRequired?: unknown }).approvalRequired); await db.from("evaluation_runs").update({ status: "completed", actual_output: actual, score: scored.score, passed, latency_ms: latencyMs, failure_rate: 0, retry_rate: 0, approval_rate: approvalRequired ? 1 : 0, resource_usage: { wallClockMs: latencyMs }, trace, warnings: scored.missing.length ? [{ code: "expectation_mismatch", missing: scored.missing }] : [], completed_at: new Date().toISOString() }).eq("id", runId); await db.from("evaluation_run_events").insert({ run_id: runId, event_type: "completed", stage: "evaluation", payload: { score: scored.score, passed, latencyMs } }); return { status: "completed", score: scored.score, passed, latencyMs, actual }; }
  catch (error) { const message = error instanceof Error ? error.message : String(error); const latencyMs = Date.now() - started; await db.from("evaluation_runs").update({ status: "failed", passed: false, score: 0, latency_ms: latencyMs, failure_rate: 1, errors: [{ message }], completed_at: new Date().toISOString() }).eq("id", runId); await db.from("evaluation_run_events").insert({ run_id: runId, event_type: "failed", stage: "evaluation", payload: { message, latencyMs } }); throw error; }
}
