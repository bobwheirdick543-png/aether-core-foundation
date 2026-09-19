import { createHash } from "node:crypto";

export type WebSearchType = "auto" | "fast" | "instant" | "deep-lite" | "deep" | "deep-reasoning";

export type WebSearchRequest = {
  query: string;
  type?: WebSearchType;
  numResults?: number;
  stream?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  maxAgeHours?: number;
  fresh?: boolean;
  deep?: boolean;
  maxCharacters?: number;
  includeHtmlTags?: boolean;
  verbosity?: "compact" | "standard" | "full";
  includeSections?: string[];
  excludeSections?: string[];
  highlightsQuery?: string;
  highlightsMaxCharacters?: number;
  summary?: boolean | { query?: string; schema?: Record<string, unknown> };
  summaryQuery?: string;
  subpages?: number;
  subpageTarget?: string | string[];
  linkCount?: number;
  imageLinkCount?: number;
  signal?: AbortSignal;
  category?: "company" | "people" | "publication" | "news" | "personal site" | "financial report" | string;
  userLocation?: string;
  startPublishedDate?: string;
  endPublishedDate?: string;
  moderation?: boolean;
  additionalQueries?: string[];
  systemPrompt?: string;
  outputSchema?: Record<string, unknown>;
};

export type WebSearchResult = {
  requestId: string;
  searchType: string;
  results: Array<{
    id?: string;
    title: string;
    url: string;
    publishedDate?: string | null;
    author?: string | null;
    text?: string | null;
    highlights?: string[];
    highlightScores?: number[];
    summary?: string | null;
    extras?: { links?: string[]; imageLinks?: string[] };
    subpages?: unknown[];
  }>;
  output?: { content?: unknown; grounding?: unknown[] } | null;
  costDollars?: number | null;
  latencyMs: number;
};

const EXA_ENDPOINT = "https://api.exa.ai/search";
const DEFAULT_TIMEOUT_MS = 45_000;

function getExaKey(): string | null {
  const key = process.env.EXA_API_KEY?.trim();
  return key || null;
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value!)));
}

function timeoutFor(type: WebSearchType): number {
  if (type === "deep-reasoning") return 45_000;
  if (type === "deep" || type === "deep-lite") return 30_000;
  if (type === "instant") return 10_000;
  return 15_000;
}

function safeStringArray(values: string[] | undefined, max: number): string[] | undefined {
  if (!values?.length) return undefined;
  return values.map((value) => value.trim()).filter(Boolean).slice(0, max);
}

function validateCategoryFilters(input: WebSearchRequest): void {
  const restrictedCategory = input.category === "company" || input.category === "people";
  if (restrictedCategory && (input.excludeDomains?.length || input.startPublishedDate || input.endPublishedDate)) {
    throw new Error(`Exa category "${input.category}" does not support excludeDomains or publication date filters`);
  }
}

function validateOutputSchema(schema: Record<string, unknown> | undefined): void {
  if (!schema) return;
  if (schema.type !== "object" && schema.type !== "text") throw new Error("Exa outputSchema.type must be object or text");
}

function queryFingerprint(query: string): string {
  return createHash("sha256").update(query).digest("hex").slice(0, 16);
}

/**
 * Single server-only provider boundary for all Aether live-web agents.
 * No client code, agent prompt, database row, or task payload receives EXA_API_KEY.
 */
export async function searchWeb(input: WebSearchRequest): Promise<WebSearchResult> {
  const apiKey = getExaKey();
  if (!apiKey) throw new Error("Web search is not configured: EXA_API_KEY is missing on the server");

  const query = input.query.trim().slice(0, 2000);
  if (!query) throw new Error("Web search query is required");
  validateCategoryFilters(input);
  validateOutputSchema(input.outputSchema);

  const type = input.type ?? (input.deep ? "deep" : "auto");
  const numResults = clampInt(input.numResults, 8, 1, 100);
  const maxCharacters = clampInt(input.maxCharacters, 12000, 1000, 50000);
  const subpages = clampInt(input.subpages, 0, 0, 10);
  const linkCount = clampInt(input.linkCount, 0, 0, 20);
  const imageLinkCount = clampInt(input.imageLinkCount, 0, 20);

  const highlights = input.highlightsQuery || input.highlightsMaxCharacters
    ? { ...(input.highlightsQuery ? { query: input.highlightsQuery.slice(0, 2000) } : {}), ...(input.highlightsMaxCharacters ? { maxCharacters: clampInt(input.highlightsMaxCharacters, 1200, 100, 10000) } : {}) }
    : true;

  const contents: Record<string, unknown> = {
    highlights,
    text: {
      maxCharacters,
      ...(input.includeHtmlTags !== undefined ? { includeHtmlTags: input.includeHtmlTags } : {}),
      ...(input.verbosity ? { verbosity: input.verbosity } : {}),
      ...(input.includeSections?.length ? { includeSections: safeStringArray(input.includeSections, 7) } : {}),
      ...(input.excludeSections?.length ? { excludeSections: safeStringArray(input.excludeSections, 7) } : {}),
    },
    ...(input.summary !== undefined
      ? { summary: input.summary === true ? true : { ...(input.summaryQuery ? { query: input.summaryQuery.slice(0, 2000) } : {}), ...(input.summary.schema ? { schema: input.summary.schema } : {}), ...input.summary } }
      : {}),
    ...(input.maxAgeHours !== undefined || input.fresh ? { maxAgeHours: input.fresh ? 0 : input.maxAgeHours } : {}),
    ...(subpages ? { subpages, ...(input.subpageTarget ? { subpageTarget: input.subpageTarget } : {}) } : {}),
    ...(linkCount || imageLinkCount ? { extras: { ...(linkCount ? { links: linkCount } : {}), ...(imageLinkCount ? { imageLinks: imageLinkCount } : {}) } } : {}),
  };

  const body: Record<string, unknown> = {
    query,
    type,
    numResults,
    contents,
    ...(input.category ? { category: input.category } : {}),
    ...(input.userLocation ? { userLocation: input.userLocation.slice(0, 2).toUpperCase() } : {}),
    ...(input.startPublishedDate ? { startPublishedDate: input.startPublishedDate } : {}),
    ...(input.endPublishedDate ? { endPublishedDate: input.endPublishedDate } : {}),
    ...(input.moderation !== undefined ? { moderation: input.moderation } : {}),
    ...(input.additionalQueries?.length ? { additionalQueries: input.additionalQueries.slice(0, 20) } : {}),
    ...(input.systemPrompt ? { systemPrompt: input.systemPrompt.slice(0, 8000) } : {}),
    ...(input.outputSchema ? { outputSchema: input.outputSchema } : {}),
    ...(input.stream ? { stream: true } : {}),
  };

  const includeDomains = safeStringArray(input.includeDomains, 1200);
  const excludeDomains = safeStringArray(input.excludeDomains, 1200);
  if (includeDomains?.length) body.includeDomains = includeDomains;
  if (excludeDomains?.length) body.excludeDomains = excludeDomains;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutFor(type));
  const onAbort = () => controller.abort();
  input.signal?.addEventListener("abort", onAbort, { once: true });
  const started = Date.now();

  try {
    const response = await fetch(EXA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: any = null;
    try { payload = JSON.parse(raw); } catch { payload = null; }

    if (!response.ok) {
      const providerError = typeof payload?.error === "string" ? payload.error : `Exa search failed with HTTP ${response.status}`;
      const error = new Error(providerError);
      Object.assign(error, { status: response.status, queryFingerprint: queryFingerprint(query) });
      throw error;
    }

    return {
      requestId: String(payload?.requestId ?? `aether-${Date.now()}`),
      searchType: String(payload?.searchType ?? type),
      results: Array.isArray(payload?.results)
        ? payload.results.map((item: any) => ({
            id: item?.id,
            title: String(item?.title ?? "Untitled source"),
            url: String(item?.url ?? ""),
            publishedDate: item?.publishedDate ?? null,
            author: item?.author ?? null,
            text: item?.text ?? null,
            highlights: Array.isArray(item?.highlights) ? item.highlights : [],
            highlightScores: Array.isArray(item?.highlightScores) ? item.highlightScores.map(Number).filter(Number.isFinite) : [],
            summary: item?.summary ?? null,
            extras: item?.extras,
            subpages: Array.isArray(item?.subpages) ? item.subpages : [],
          }))
            .filter((item: any) => /^https?:\/\//i.test(item.url))
        : [],
      output: payload?.output ?? null,
      costDollars: Number.isFinite(payload?.costDollars?.total) ? Number(payload.costDollars.total) : null,
      latencyMs: Math.max(0, Date.now() - started),
    };
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", onAbort);
  }
}

export function webSearchConfigured(): boolean {
  return Boolean(getExaKey());
}
