import type { SupabaseClient } from "@supabase/supabase-js";
import { domainFromUrl, normalizeUrl, sourceQualityScore, type RetrievedPage } from "./research-engine";
import { runAetherWebResearch, persistAetherWebResearch, persistResearchDiscoveryEvent, type AetherWebResearchResult, type AetherWebSource } from "./aax-web-intelligence";
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
  return { topic: clean, strategy, queries: [clean, `${clean} evidence`, `${clean} official documentation`, `${clean} recent developments`], sourceRequirements: { minSources: strategy === "source_comparison" ? 4 : 3, minDomains: strategy === "source_comparison" ? 3 : 2, preferredProviders: ["official", "academic", "government", "wikipedia", "reddit", "duckduckgo"] }, comparisonRules: { compareDates: true, compareAgreement: true, flagConflicts: true } };
}

export type SourceComparison = {
  subject: string;
  sourceIds: string[];
  domains: string[];
  agreementSignals: string[];
  contradictionSignals: string[];
  dateMismatches: string[];
  freshnessSignals: string[];
  missingEvidence: string[];
  uncertainty: string[];
  quality: Array<{ sourceId: string; score: number; factors: Record<string, number> }>;
};

export function compareResearchSources(subject: string, sources: Array<{ id: string; url: string; title?: string | null; content?: string | null; publishedAt?: string | null; updatedAt?: string | null; page?: RetrievedPage }>): SourceComparison {
  const normalized = sources.map((source) => ({ ...source, normalizedUrl: normalizeUrl(source.url), domain: domainFromUrl(source.url) }));
  const domains = [...new Set(normalized.map((source) => source.domain))];
  const terms = normalized.map((source) => new Set((source.content ?? "").toLowerCase().split(/\W+/).filter((term) => term.length > 5)));
  const agreementSignals: string[] = [];
  const contradictionSignals: string[] = [];
  const missingEvidence: string[] = [];
  const uncertainty: string[] = [];
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
  if (!normalized.length) { missingEvidence.push("No retrieved sources were available for comparison"); uncertainty.push("Comparison cannot establish evidence without retrieved sources"); }
  else {
    const undated = normalized.filter((source) => !source.updatedAt && !source.publishedAt).length;
    if (undated) missingEvidence.push(`${undated} source(s) have no publication or update date`);
    if (domains.length < 2) uncertainty.push("Only one source domain is represented; cross-source agreement is limited");
    if (contradictionSignals.length) uncertainty.push("Source terminology differs; contradictions require verification");
  }
  return { subject, sourceIds: normalized.map((source) => source.id), domains, agreementSignals, contradictionSignals, dateMismatches, freshnessSignals, missingEvidence, uncertainty, quality: normalized.map((source) => { const page = source.page ?? ({ status: 200, text: source.content ?? "", error: undefined, stale: false } as RetrievedPage); const quality = sourceQualityScore(page); return { sourceId: source.id, score: quality.score, factors: quality.factors }; }) };
}

function isGithubRepositoryUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.hostname.toLowerCase() === "github.com" && /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/)?(?:[#?].*)?$/.test(url.pathname + url.search + url.hash);
  } catch { return false; }
}

function parseGithubRepositoryUrl(value: string): { owner: string; repo: string; canonicalUrl: string } | null {
  try {
    const url = new URL(value.trim());
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    if (["issues", "pulls", "actions", "releases", "discussions", "wiki", "settings", "security"].includes(parts[2]?.toLowerCase() ?? "")) return null;
    const owner = parts[0].replace(/[^A-Za-z0-9_.-]/g, "");
    const repo = parts[1].replace(/\.git$/i, "").replace(/[^A-Za-z0-9_.-]/g, "");
    if (!owner || !repo) return null;
    return { owner, repo, canonicalUrl: `https://github.com/${owner}/${repo}` };
  } catch { return null; }
}

const GITHUB_TEXT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst", ".adoc", ".json", ".yaml", ".yml", ".toml", ".ini", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".kt", ".swift", ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp", ".sql", ".sh", ".css", ".scss", ".html", ".vue", ".svelte", ".xml"]);
const GITHUB_SKIP_PARTS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "vendor", "target", "tmp", "cache"]);
const GITHUB_MAX_FILES = 40;
const GITHUB_MAX_FILE_BYTES = 180_000;
const GITHUB_MAX_TOTAL_BYTES = 3_000_000;

function simpleContentHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function githubHeaders(): HeadersInit { return { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "AetherResearch/1.0" }; }

function prioritizeGithubPath(path: string): number {
  const lower = path.toLowerCase();
  const basename = lower.split("/").pop() ?? lower;
  if (basename === "readme.md" || basename === "readme") return 1000;
  if (/^(license|copying|changelog|contributing|security|code_of_conduct)/.test(basename)) return 800;
  if (/^(package\.json|pyproject\.toml|cargo\.toml|go\.mod|composer\.json|pom\.xml|requirements\.txt)$/.test(basename)) return 750;
  if (/(^|\/)(docs?|documentation)(\/|$)/.test(lower)) return 700;
  if (/(^|\/)(src|app|lib|server|packages)(\/|$)/.test(lower)) return 600;
  return 100;
}

async function ingestGithubRepository(repositoryUrl: string, signal?: AbortSignal): Promise<{ sources: AetherWebSource[]; failedSources: AetherWebResearchResult["failedSources"] }> {
  const parsed = parseGithubRepositoryUrl(repositoryUrl);
  if (!parsed) return { sources: [], failedSources: [{ url: repositoryUrl, provider: "github", error: "The supplied URL is not a public GitHub repository URL", failureClass: "invalid_repository_url" }] };
  const apiBase = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
  const metadataResponse = await fetch(apiBase, { headers: githubHeaders(), signal });
  if (!metadataResponse.ok) return { sources: [], failedSources: [{ url: parsed.canonicalUrl, provider: "github", error: `GitHub repository metadata failed (${metadataResponse.status})`, failureClass: "github_metadata" }] };
  const metadata = await metadataResponse.json() as { default_branch?: string; private?: boolean; archived?: boolean; description?: string | null; updated_at?: string | null };
  if (metadata.private) return { sources: [], failedSources: [{ url: parsed.canonicalUrl, provider: "github", error: "Private repositories are not ingested by the public repository acquisition path", failureClass: "private_repository" }] };
  const branch = metadata.default_branch || "main";
  const treeResponse = await fetch(`${apiBase}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: githubHeaders(), signal });
  if (!treeResponse.ok) return { sources: [], failedSources: [{ url: parsed.canonicalUrl, provider: "github", error: `GitHub repository tree failed (${treeResponse.status})`, failureClass: "github_tree" }] };
  const tree = await treeResponse.json() as { truncated?: boolean; tree?: Array<{ path?: string; type?: string; size?: number; url?: string }> };
  const candidates = (tree.tree ?? []).filter((entry) => entry.type === "blob" && entry.path).filter((entry) => { const parts = String(entry.path).split("/"); return !parts.some((part) => GITHUB_SKIP_PARTS.has(part.toLowerCase())); }).filter((entry) => { const path = String(entry.path); const dot = path.lastIndexOf("."); return dot >= 0 && GITHUB_TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase()); }).filter((entry) => Number(entry.size ?? 0) <= GITHUB_MAX_FILE_BYTES).sort((a, b) => prioritizeGithubPath(String(b.path)) - prioritizeGithubPath(String(a.path)) || String(a.path).length - String(b.path).length).slice(0, GITHUB_MAX_FILES);
  const selected: Array<{ path: string; text: string; size: number }> = [];
  let totalBytes = 0;
  let cursor = 0;
  const worker = async () => { for (;;) { if (signal?.aborted) throw new DOMException("GitHub ingestion cancelled", "AbortError"); const index = cursor++; if (index >= candidates.length) return; const entry = candidates[index]; const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/${encodeURIComponent(branch)}/${String(entry.path).split("/").map(encodeURIComponent).join("/")}`; const response = await fetch(rawUrl, { headers: { "User-Agent": "AetherResearch/1.0", Accept: "text/plain" }, signal }); if (!response.ok) return; const text = (await response.text()).slice(0, GITHUB_MAX_FILE_BYTES); const size = new TextEncoder().encode(text).byteLength; if (totalBytes + size > GITHUB_MAX_TOTAL_BYTES) return; totalBytes += size; selected.push({ path: String(entry.path), text, size }); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const sources = selected.map((file) => { const url = `https://github.com/${parsed.owner}/${parsed.repo}/blob/${branch}/${file.path}`; const content = `Repository: ${parsed.canonicalUrl}\nBranch: ${branch}\nFile: ${file.path}\nRepository description: ${metadata.description ?? ""}\nLast repository update: ${metadata.updated_at ?? "unknown"}\n\n${file.text}`; return { url, canonicalUrl: url, title: `${parsed.owner}/${parsed.repo} — ${file.path}`, domain: "github.com", provider: "direct" as const, snippet: `Public GitHub repository file: ${file.path}`, text: content, status: 200, contentHash: simpleContentHash(content), retrievedAt: new Date().toISOString(), publishedAt: null, updatedAt: metadata.updated_at ?? null, contentType: "text/plain", contentLength: file.size, qualityScore: 0.9, qualityFactors: { publicRepository: 1, textContent: 1, boundedSelection: 1 } }; });
  return { sources, failedSources: [] };
}

async function runQueriesBounded(queries: string[], signal?: AbortSignal): Promise<AetherWebResearchResult[]> {
  const results: AetherWebResearchResult[] = [];
  let cursor = 0;
  const worker = async () => { for (;;) { if (signal?.aborted) throw new DOMException("Research cancelled", "AbortError"); const index = cursor++; if (index >= queries.length) return; results[index] = await runAetherWebResearch({ query: queries[index], maxSources: 8, signal }); } };
  await Promise.all([worker(), worker()]);
  return results;
}

export async function runPlannedResearch(input: { admin: SupabaseClient; ownerId: string; projectId?: string | null; plan: ResearchPlan; taskId?: string | null; runId?: string | null; signal?: AbortSignal }): Promise<{ sessionId: string; result: AetherWebResearchResult; plan: ResearchPlan; unmetRequirements: string[] }> {
  const githubUrl = input.plan.topic.match(/https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i)?.[0] ?? (isGithubRepositoryUrl(input.plan.topic) ? input.plan.topic : null);
  const [results, github] = await Promise.all([runQueriesBounded(input.plan.queries, input.signal), githubUrl ? ingestGithubRepository(githubUrl, input.signal) : Promise.resolve({ sources: [] as AetherWebSource[], failedSources: [] as AetherWebResearchResult["failedSources"] })]);
  const sources = [...new Map([...results.flatMap((result) => result.sources), ...github.sources].map((source) => [normalizeUrl(source.canonicalUrl || source.url), source])).values()].slice(0, 64);
  const domains = [...new Set(sources.map((source) => source.domain))];
  const unmetRequirements = unmetSourceRequirements(sources.length, domains.length, input.plan.sourceRequirements);
  const merged: AetherWebResearchResult = { query: input.plan.topic, sources, failedSources: [...results.flatMap((result) => result.failedSources), ...github.failedSources], sourceDomains: domains, diversity: sources.length ? Math.min(1, domains.length / Math.min(5, sources.length)) : 0, completedAt: new Date().toISOString() };
  const sessionId = await persistAetherWebResearch(input.admin, { ownerId: input.ownerId, projectId: input.projectId, scope: "agent", query: input.plan.topic, result: merged, taskId: input.taskId, runId: input.runId });
  await persistResearchPlan(input.admin, input.ownerId, sessionId, input.plan, unmetRequirements, input.projectId);
  for (let i = 0; i < input.plan.queries.length; i++) {
    const queryResult = results[i];
    await persistResearchDiscoveryEvent(input.admin, { ownerId: input.ownerId, projectId: input.projectId, sessionId, taskId: input.taskId, runId: input.runId, sequence: i + 1, provider: "multi-source", query: input.plan.queries[i], status: queryResult ? "completed" : "failed", resultCount: queryResult?.sources.length ?? 0, data: { failed_sources: queryResult?.failedSources.length ?? 0, source_domains: queryResult?.sourceDomains ?? [] } });
  }
  if (githubUrl) await persistResearchDiscoveryEvent(input.admin, { ownerId: input.ownerId, projectId: input.projectId, sessionId, taskId: input.taskId, runId: input.runId, sequence: input.plan.queries.length + 1, provider: "github", query: githubUrl, status: github.sources.length ? "completed" : "failed", resultCount: github.sources.length, data: { repository_ingestion: true, bounded_file_count: github.sources.length, failed_sources: github.failedSources.length } });
  return { sessionId, result: merged, plan: input.plan, unmetRequirements };
}

export async function persistResearchPlan(admin: SupabaseClient, ownerId: string, sessionId: string, plan: ResearchPlan, unmetRequirements: string[] = [], projectId?: string | null): Promise<string> {
  const { data, error } = await admin.from("aether_research_plans").insert({ owner_id: ownerId, project_id: projectId ?? null, session_id: sessionId, topic: plan.topic, strategy: plan.strategy, queries: plan.queries, source_requirements: plan.sourceRequirements, comparison_rules: plan.comparisonRules, unmet_requirements: unmetRequirements, status: "completed" }).select("id").single();
  if (error || !data) throw new Error(`Could not persist research plan: ${error?.message ?? "unknown error"}`);
  return data.id as string;
}

export async function persistResearchComparison(admin: SupabaseClient, ownerId: string, sessionId: string, comparison: SourceComparison, projectId?: string | null): Promise<string> {
  const { data, error } = await admin.from("aether_research_comparisons").insert({ owner_id: ownerId, project_id: projectId ?? null, session_id: sessionId, subject: comparison.subject, source_ids: comparison.sourceIds, comparison, missing_evidence: comparison.missingEvidence, uncertainty: comparison.uncertainty, status: "completed" }).select("id").single();
  if (error || !data) throw new Error(`Could not persist research comparison: ${error?.message ?? "unknown error"}`);
  return data.id as string;
}
