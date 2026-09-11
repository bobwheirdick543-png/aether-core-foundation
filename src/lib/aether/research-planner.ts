import type { SupabaseClient } from "@supabase/supabase-js";
import { domainFromUrl, normalizeUrl, sourceQualityScore, type RetrievedPage } from "./research-engine";
import { runAetherWebResearch, persistAetherWebResearch, type AetherWebResearchResult } from "./aax-web-intelligence";
import { unmetSourceRequirements } from "./research-policy";

export type ResearchPlan = {
  topic: string;
  strategy: "multi_source" | "source_comparison" | "freshness_check";
  queries: string[];
  sourceRequirements: { minSources: number; minDomains: number; preferredProviders: string[] };
  comparisonRules: { compareDates: boolean; compareAgreement: boolean; flagConflicts: boolean };
};

export function createResearchPlan(topic: string, strategy: ResearchPlan["strategy"] = "multi_source"): ResearchPlan {
  const clean = topic.trim().slice(0, 500);
  if (clean.length < 3) throw new Error("Research topic is required");
  return {
    topic: clean,
    strategy,
    queries: [clean, `${clean} evidence`, `${clean} official documentation`, `${clean} recent developments`],
    sourceRequirements: {
      minSources: strategy === "source_comparison" ? 4 : 3,
      minDomains: strategy === "source_comparison" ? 3 : 2,
      preferredProviders: ["official", "academic", "government", "wikipedia", "reddit", "duckduckgo"],
    },
    comparisonRules: { compareDates: true, compareAgreement: true, flagConflicts: true },
  };
}

export type SourceComparison = {
  subject: string;
  sourceIds: string[];
  domains: string[];
  agreementSignals: string[];
  contradictionSignals: string[];
  dateMismatches: string[];
  freshnessSignals: string[];
  quality: Array<{ sourceId: string; score: number; factors: Record<string, number> }>;
};

export function compareResearchSources(subject: string, sources: Array<{ id: string; url: string; title?: string | null; content?: string | null; publishedAt?: string | null; updatedAt?: string | null; page?: RetrievedPage }>): SourceComparison {
  const normalized = sources.map((source) => ({ ...source, normalizedUrl: normalizeUrl(source.url), domain: domainFromUrl(source.url) }));
  const domains = [...new Set(normalized.map((source) => source.domain))];
  const terms = normalized.map((source) => new Set((source.content ?? "").toLowerCase().split(/\W+/).filter((term) => term.length > 5)));
  const agreementSignals: string[] = [];
  const contradictionSignals: string[] = [];
  if (terms.length > 1) {
    const intersection = [...terms[0]].filter((term) => terms.slice(1).every((set) => set.has(term)));
    if (intersection.length) agreementSignals.push(`Shared terminology across ${intersection.length} content terms`);
    const all = new Set(terms.flatMap((set) => [...set]));
    const disagreement = [...all].filter((term) => terms.filter((set) => set.has(term)).length === 1).slice(0, 20);
    if (disagreement.length) contradictionSignals.push(`Unique source terminology requires review: ${disagreement.join(", ")}`);
  }
  const dates = normalized.flatMap((source) => [source.publishedAt, source.updatedAt].filter(Boolean).map((value) => ({ id: source.id, value: String(value) })));
  const dateMismatches = dates.length > 1 ? [`${dates.length} source dates available for comparison`] : [];
  const freshnessSignals = normalized.map((source) => `${source.domain}: ${source.updatedAt ?? source.publishedAt ?? "no publication date"}`);
  return {
    subject,
    sourceIds: normalized.map((source) => source.id),
    domains,
    agreementSignals,
    contradictionSignals,
    dateMismatches,
    freshnessSignals,
    quality: normalized.map((source) => {
      const page = source.page ?? ({ status: 200, text: source.content ?? "", error: undefined, stale: false } as RetrievedPage);
      const quality = sourceQualityScore(page);
      return { sourceId: source.id, score: quality.score, factors: quality.factors };
    }),
  };
}

async function runQueriesBounded(queries: string[], signal?: AbortSignal): Promise<AetherWebResearchResult[]> {
  const results: AetherWebResearchResult[] = [];
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Research cancelled", "AbortError");
      const index = cursor++;
      if (index >= queries.length) return;
      results[index] = await runAetherWebResearch({ query: queries[index], maxSources: 8, signal });
    }
  };
  await Promise.all([worker(), worker()]);
  return results;
}

export async function runPlannedResearch(input: { admin: SupabaseClient; ownerId: string; plan: ResearchPlan; taskId?: string | null; runId?: string | null; signal?: AbortSignal }): Promise<{ sessionId: string; result: AetherWebResearchResult; plan: ResearchPlan; unmetRequirements: string[] }> {
  const results = await runQueriesBounded(input.plan.queries, input.signal);
  const sources = [...new Map(results.flatMap((result) => result.sources).map((source) => [normalizeUrl(source.canonicalUrl || source.url), source])).values()].slice(0, 24);
  const domains = [...new Set(sources.map((source) => source.domain))];
  const unmetRequirements = unmetSourceRequirements(sources.length, domains.length, input.plan.sourceRequirements);
  const merged: AetherWebResearchResult = {
    query: input.plan.topic,
    sources,
    failedSources: results.flatMap((result) => result.failedSources),
    sourceDomains: domains,
    diversity: sources.length ? Math.min(1, domains.length / Math.min(5, sources.length)) : 0,
    completedAt: new Date().toISOString(),
  };
  const sessionId = await persistAetherWebResearch(input.admin, {
    ownerId: input.ownerId,
    scope: "agent",
    query: input.plan.topic,
    result: merged,
    taskId: input.taskId,
    runId: input.runId,
  });
  await persistResearchPlan(input.admin, input.ownerId, sessionId, input.plan, unmetRequirements);
  return { sessionId, result: merged, plan: input.plan, unmetRequirements };
}

export async function persistResearchPlan(admin: SupabaseClient, ownerId: string, sessionId: string, plan: ResearchPlan, unmetRequirements: string[] = []): Promise<string> {
  const { data, error } = await admin.from("aether_research_plans").insert({ owner_id: ownerId, session_id: sessionId, topic: plan.topic, strategy: plan.strategy, queries: plan.queries, source_requirements: plan.sourceRequirements, comparison_rules: plan.comparisonRules, unmet_requirements: unmetRequirements, status: "completed" }).select("id").single();
  if (error || !data) throw new Error(`Could not persist research plan: ${error?.message ?? "unknown error"}`);
  return data.id as string;
}

export async function persistResearchComparison(admin: SupabaseClient, ownerId: string, sessionId: string, comparison: SourceComparison): Promise<string> {
  const { data, error } = await admin.from("aether_research_comparisons").insert({ owner_id: ownerId, session_id: sessionId, subject: comparison.subject, source_ids: comparison.sourceIds, comparison, status: "completed" }).select("id").single();
  if (error || !data) throw new Error(`Could not persist research comparison: ${error?.message ?? "unknown error"}`);
  return data.id as string;
}
