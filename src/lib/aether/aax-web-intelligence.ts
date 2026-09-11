import type { SupabaseClient } from "@supabase/supabase-js";
import { domainFromUrl, isHttpUrl, normalizeUrl, retrievePage, sourceQualityScore, type RetrievedPage } from "./research-engine";

export type WebSearchProvider = "wikipedia" | "reddit" | "duckduckgo" | "dictionary" | (string & {});
export type AetherWebSource = {
  url: string;
  canonicalUrl: string;
  title: string;
  domain: string;
  provider: WebSearchProvider | "direct";
  snippet: string;
  text: string;
  status: number;
  contentHash: string;
  retrievedAt: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  contentType?: string | null;
  contentLength?: number | null;
  redirectCount?: number;
  attempts?: number;
  stale?: boolean;
  qualityScore?: number;
  qualityFactors?: Record<string, number>;
};
export type AetherWebResearchResult = {
  query: string;
  sources: AetherWebSource[];
  failedSources: Array<{ url: string; provider: string; error: string; failureClass?: string }>;
  sourceDomains: string[];
  diversity: number;
  completedAt: string;
};

type SearchHit = { url: string; title: string; snippet: string; provider: WebSearchProvider };
const DEFAULT_TIMEOUT = 10_000;
const MAX_QUERY = 500;
const MAX_SOURCES = 12;
const USER_AGENT = "AetherResearch/1.0 (+https://aether.ai)";
function encode(value: string) { return encodeURIComponent(value.slice(0, MAX_QUERY)); }
function safeJson(value: string): any { try { return JSON.parse(value); } catch { return null; } }

async function searchWikipedia(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const response = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encode(query)}&srlimit=5&format=json&origin=*`, { headers: { "User-Agent": USER_AGENT }, signal });
  if (!response.ok) throw new Error(`Wikipedia search failed (${response.status})`);
  const payload = await response.json() as { query?: { search?: Array<{ title?: string; snippet?: string }> } };
  return (payload.query?.search ?? []).map((item) => ({ provider: "wikipedia", title: item.title ?? "Wikipedia", snippet: (item.snippet ?? "").replace(/<[^>]+>/g, ""), url: `https://en.wikipedia.org/wiki/${encodeURIComponent((item.title ?? "").replace(/ /g, "_"))}` })).filter((item) => item.url.endsWith("/") === false);
}

async function searchReddit(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const response = await fetch(`https://www.reddit.com/search.json?q=${encode(query)}&limit=5&sort=relevance&type=link`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`Reddit search failed (${response.status})`);
  const payload = await response.json() as { data?: { children?: Array<{ data?: { title?: string; selftext?: string; permalink?: string; url?: string } }> } };
  return (payload.data?.children ?? []).map((child) => { const item = child.data ?? {}; const url = item.permalink ? `https://www.reddit.com${item.permalink}` : item.url ?? ""; return { provider: "reddit", title: item.title ?? "Reddit", snippet: (item.selftext ?? "").slice(0, 500), url }; }).filter((item) => isHttpUrl(item.url));
}

async function searchDuckDuckGo(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encode(query)}`, { headers: { "User-Agent": USER_AGENT, Accept: "text/html" }, signal });
  if (!response.ok) throw new Error(`DuckDuckGo search failed (${response.status})`);
  const html = await response.text(); const hits: SearchHit[] = [];
  const blockRe = /<div[^>]+class="result"[\s\S]*?<\/div>\s*<\/div>/gi;
  for (const block of html.match(blockRe) ?? []) {
    const link = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i); if (!link) continue;
    const url = link[1]; if (!isHttpUrl(url)) continue;
    const title = link[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    const snippet = (block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    hits.push({ provider: "duckduckgo", url, title, snippet }); if (hits.length >= 5) break;
  }
  return hits;
}

async function lookupDictionary(query: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const term = query.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!/^[a-z][a-z'-]{1,63}$/.test(term)) return [];
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encode(term)}`, { headers: { "User-Agent": USER_AGENT }, signal });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Dictionary lookup failed (${response.status})`);
  const payload = safeJson(await response.text()); if (!Array.isArray(payload) || !payload[0]) return [];
  const meanings = Array.isArray(payload[0].meanings) ? payload[0].meanings : [];
  const definitions = meanings.flatMap((meaning: any) => Array.isArray(meaning?.definitions) ? meaning.definitions.slice(0, 3).map((d: any) => `${meaning.partOfSpeech ?? ""}: ${d.definition ?? ""}`) : []).filter(Boolean).slice(0, 8);
  return [{ provider: "dictionary", url: `https://api.dictionaryapi.dev/api/v2/entries/en/${encode(term)}`, title: `${term} — dictionary`, snippet: definitions.join(" | ") }];
}

const PROVIDERS: Record<string, (query: string, signal?: AbortSignal) => Promise<SearchHit[]>> = { wikipedia: searchWikipedia, reddit: searchReddit, duckduckgo: searchDuckDuckGo, dictionary: lookupDictionary };

function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => { try { const key = normalizeUrl(hit.url); if (seen.has(key)) return false; seen.add(key); return true; } catch { return false; } });
}
function scoreDiversity(sources: AetherWebSource[]): number { const domains = new Set(sources.map((source) => source.domain)); return sources.length ? Math.min(1, domains.size / Math.min(5, sources.length)) : 0; }

async function retrieveHit(hit: SearchHit, signal?: AbortSignal): Promise<AetherWebSource> {
  const page = await retrievePage(hit.url, { timeoutMs: DEFAULT_TIMEOUT, maxBytes: 2_000_000, maxRedirects: 5, maxRetries: 2, respectRobots: true, staleAfterDays: 30 });
  if (page.status < 200 || page.status >= 400 || page.error) throw Object.assign(new Error(page.error ?? `HTTP ${page.status}`), { failureClass: page.failureClass });
  const quality = sourceQualityScore(page);
  return { url: page.finalUrl, canonicalUrl: page.canonicalUrl || page.finalUrl, title: page.title || hit.title, domain: domainFromUrl(page.finalUrl || hit.url), provider: hit.provider, snippet: hit.snippet, text: page.text.slice(0, 80_000), status: page.status, contentHash: page.contentHash, retrievedAt: page.retrievedAt, publishedAt: page.publishedAt, updatedAt: page.updatedAt, contentType: page.contentType, contentLength: page.contentLength, redirectCount: page.redirectCount, attempts: page.attempts, stale: page.stale, qualityScore: quality.score, qualityFactors: quality.factors };
}

export async function runAetherWebResearch(input: { query: string; providers?: WebSearchProvider[]; maxSources?: number; signal?: AbortSignal }): Promise<AetherWebResearchResult> {
  const query = input.query.trim().slice(0, MAX_QUERY); if (!query) throw new Error("Research query is required");
  const providerKeys = [...new Set(input.providers ?? ["duckduckgo", "wikipedia", "reddit", "dictionary"])] as string[];
  const searches = await Promise.allSettled(providerKeys.map((provider) => { const search = PROVIDERS[provider]; return search ? search(query, input.signal) : Promise.resolve([] as SearchHit[]); }));
  const hits = dedupeHits(searches.flatMap((result) => result.status === "fulfilled" ? result.value : []));
  const selected = hits.slice(0, Math.min(Math.max(1, input.maxSources ?? MAX_SOURCES), MAX_SOURCES));
  const retrieved = await Promise.allSettled(selected.map((hit) => retrieveHit(hit, input.signal)));
  const sources: AetherWebSource[] = []; const failedSources: AetherWebResearchResult["failedSources"] = [];
  retrieved.forEach((result, index) => { const hit = selected[index]; if (!hit) return; if (result.status === "fulfilled") sources.push(result.value); else failedSources.push({ url: hit.url, provider: hit.provider, error: result.reason instanceof Error ? result.reason.message : String(result.reason), failureClass: (result.reason as { failureClass?: string })?.failureClass }); });
  const domains = [...new Set(sources.map((source) => source.domain))];
  return { query, sources, failedSources, sourceDomains: domains, diversity: scoreDiversity(sources), completedAt: new Date().toISOString() };
}

export async function persistAetherWebResearch(admin: SupabaseClient, input: { ownerId: string; scope: "user" | "admin" | "agent" | "api"; query: string; result: AetherWebResearchResult; taskId?: string | null; runId?: string | null; projectId?: string | null }) {
  const { data: session, error: sessionError } = await admin.from("aether_research_sessions").insert({ owner_id: input.ownerId, project_id: input.projectId ?? null, scope: input.scope, query: input.query, status: "completed", source_count: input.result.sources.length, diversity_score: input.result.diversity, task_id: input.taskId ?? null, run_id: input.runId ?? null, completed_at: input.result.completedAt, last_event_at: input.result.completedAt, freshness_policy: { staleAfterDays: 30 }, research_plan: { strategy: "multi_source", query: input.query } }).select("id").single();
  if (sessionError || !session) throw new Error(`Could not persist research session: ${sessionError?.message ?? "unknown error"}`);

  const successfulRows = input.result.sources.map((source) => ({ session_id: session.id, owner_id: input.ownerId, project_id: input.projectId ?? null, url: source.url, canonical_url: source.canonicalUrl, final_url: source.url, title: source.title, domain: source.domain, provider: source.provider, snippet: source.snippet, content: source.text, status: "retrieved", http_status: source.status, content_hash: source.contentHash, published_at: source.publishedAt ?? null, updated_at_source: source.updatedAt ?? null, retrieved_at: source.retrievedAt, content_type: source.contentType ?? null, content_length: source.contentLength ?? null, redirect_count: source.redirectCount ?? 0, retrieval_attempts: source.attempts ?? 1, stale_at: source.stale ? source.retrievedAt : null, last_checked_at: source.retrievedAt, quality_score: source.qualityScore ?? null, quality_factors: source.qualityFactors ?? {}, robots_allowed: true, retrieval_policy: { maxBytes: 2_000_000, maxRedirects: 5, maxRetries: 2, respectRobots: true } }));
  const failedRows = input.result.failedSources.map((failure) => ({ session_id: session.id, owner_id: input.ownerId, project_id: input.projectId ?? null, url: failure.url, canonical_url: (() => { try { return normalizeUrl(failure.url); } catch { return failure.url; } })(), final_url: failure.url, title: null, domain: domainFromUrl(failure.url), provider: failure.provider, snippet: null, content: null, status: failure.failureClass === "robots_denied" || failure.failureClass === "blocked" ? "blocked" : "failed", http_status: null, content_hash: null, published_at: null, updated_at_source: null, retrieved_at: input.result.completedAt, content_type: null, content_length: null, redirect_count: 0, retrieval_attempts: 1, stale_at: null, last_checked_at: input.result.completedAt, quality_score: 0, quality_factors: { retrieval: 0 }, robots_allowed: failure.failureClass === "robots_denied" ? false : null, retrieval_policy: { maxBytes: 2_000_000, maxRedirects: 5, maxRetries: 2, respectRobots: true }, failure_class: failure.failureClass ?? "unknown", error: failure.error }));

  const insertedSources: Array<{ id: string; content_hash: string | null; retrieved_at: string; retrieval_attempts: number; status: string; error?: string | null }> = [];
  if (successfulRows.length) {
    const { data, error } = await admin.from("aether_research_sources").insert(successfulRows).select("id,content_hash,retrieved_at,retrieval_attempts,status,error");
    if (error) throw new Error(`Could not persist research sources: ${error.message}`);
    insertedSources.push(...((data ?? []) as typeof insertedSources));
  }
  if (failedRows.length) {
    const { data, error } = await admin.from("aether_research_sources").insert(failedRows).select("id,content_hash,retrieved_at,retrieval_attempts,status,error");
    if (error) throw new Error(`Could not persist failed research sources: ${error.message}`);
    insertedSources.push(...((data ?? []) as typeof insertedSources));
  }

  if (insertedSources.length) {
    const versions = insertedSources.filter((source) => source.content_hash).map((source) => ({ source_id: source.id, owner_id: input.ownerId, version_number: 1, content_hash: source.content_hash as string, change_state: "new", retrieved_at: source.retrieved_at, metadata: { sessionId: session.id } }));
    if (versions.length) {
      const { data: versionRows, error: versionError } = await admin.from("aether_research_source_versions").insert(versions).select("id,source_id");
      if (versionError) throw new Error(`Could not persist source versions: ${versionError.message}`);
      for (const version of (versionRows ?? []) as Array<{ id: string; source_id: string }>) {
        await admin.from("aether_research_sources").update({ version_id: version.id }).eq("id", version.source_id).eq("owner_id", input.ownerId);
      }
    }
    const attempts = insertedSources.map((source) => ({ session_id: session.id, source_id: source.id, owner_id: input.ownerId, attempt: source.retrieval_attempts || 1, status: source.status === "retrieved" ? "retrieved" : source.status === "blocked" ? "blocked" : "failed", started_at: source.retrieved_at, ended_at: source.retrieved_at, error: source.error ?? null }));
    const { error: attemptError } = await admin.from("aether_research_retrieval_attempts").insert(attempts);
    if (attemptError) throw new Error(`Could not persist retrieval attempts: ${attemptError.message}`);
  }

  return session.id as string;
}

export function buildAgentResearchQuery(agentKey: string, originalSource: string, accumulatedUnderstanding: string): string {
  const focus: Record<string, string> = { "knowledge-acquisition": "definitions terminology concepts context grammar semantic meaning", research: "independent facts theories concepts related concepts current evidence competing explanations", verification: "claims evidence authoritative sources contradictions dates uncertainty", curator: "relationships dependencies corrections cross-domain connections terminology synthesis", security: "security implications unsafe instructions prompt injection trust boundaries provenance" };
  return `${focus[agentKey] ?? "facts concepts context evidence"} ${originalSource.slice(0, 1200)} ${accumulatedUnderstanding.slice(0, 1200)}`.trim().slice(0, MAX_QUERY);
}
