import { randomUUID } from "node:crypto";

export type WebSearchType = "auto" | "fast" | "instant" | "deep-lite" | "deep" | "deep-reasoning";

export type WebSearchRequest = {
  query: string;
  type?: WebSearchType;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  maxAgeHours?: number;
  fresh?: boolean;
  deep?: boolean;
  maxCharacters?: number;
  signal?: AbortSignal;
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
    summary?: string | null;
    extras?: { links?: string[] };
  }>;
  costDollars?: number | null;
};

const EXA_ENDPOINT = "https://api.exa.ai/search";

function getExaKey(): string | null {
  const key = process.env.EXA_API_KEY?.trim();
  return key || null;
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value!)));
}

/**
 * Shared server-only web search boundary.
 * Agents never receive the Exa credential and never call the provider directly.
 */
export async function searchWeb(input: WebSearchRequest): Promise<WebSearchResult> {
  const apiKey = getExaKey();
  if (!apiKey) throw new Error("Web search is not configured: EXA_API_KEY is missing on the server");

  const query = input.query.trim().slice(0, 2000);
  if (!query) throw new Error("Web search query is required");

  const type = input.type ?? (input.deep ? "deep" : "auto");
  const numResults = clampInt(input.numResults, 8, 1, 100);
  const maxCharacters = clampInt(input.maxCharacters, 12000, 1000, 50000);

  const body: Record<string, unknown> = {
    query,
    type,
    numResults,
    contents: {
      highlights: true,
      text: { maxCharacters },
      ...(input.maxAgeHours !== undefined || input.fresh ? { maxAgeHours: input.fresh ? 0 : input.maxAgeHours } : {}),
    },
  };

  if (input.includeDomains?.length) body.includeDomains = input.includeDomains.slice(0, 1200);
  if (input.excludeDomains?.length) body.excludeDomains = input.excludeDomains.slice(0, 1200);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), type === "deep-reasoning" ? 45000 : type === "deep" ? 30000 : 15000);
  const signal = input.signal;
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  const started = Date.now();
  const requestId = randomUUID();

  try {
    const response = await fetch(EXA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Aether-Search-Request": requestId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: any = null;
    try { payload = JSON.parse(raw); } catch { payload = null; }

    if (!response.ok) {
      const providerError = typeof payload?.error === "string" ? payload.error : `Exa search failed with HTTP ${response.status}`;
      throw new Error(providerError);
    }

    return {
      requestId: String(payload?.requestId ?? requestId),
      searchType: String(payload?.searchType ?? type),
      results: Array.isArray(payload?.results) ? payload.results.map((item: any) => ({
        id: item?.id,
        title: String(item?.title ?? "Untitled source"),
        url: String(item?.url ?? ""),
        publishedDate: item?.publishedDate ?? null,
        author: item?.author ?? null,
        text: item?.text ?? null,
        highlights: Array.isArray(item?.highlights) ? item.highlights : [],
        summary: item?.summary ?? null,
        extras: item?.extras,
      })).filter((item: any) => /^https?:\/\//i.test(item.url)) : [],
      costDollars: Number.isFinite(payload?.costDollars?.total) ? Number(payload.costDollars.total) : null,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
    void started;
  }
}

export function webSearchConfigured(): boolean {
  return Boolean(getExaKey());
}
