/**
 * AETHER NATIVE WEB RESEARCH ENGINE
 *
 * Retrieval + extraction only.
 * No external AI provider required.
 * No fabricated findings.
 *
 * Separates WEB ACCESS from INTELLIGENCE/REASONING.
 */

export interface RetrievedPage {
  url: string;
  finalUrl: string;
  status: number;
  title: string | null;
  text: string;
  contentHash: string;
  retrievedAt: string;
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  description?: string | null;
  language?: string | null;
  error?: string;
}

export interface ResearchSourceMeta {
  url: string;
  domain: string;
  title: string | null;
  retrievedAt: string;
  publishedAt?: string | null;
  sourceType: "web" | "document" | "upload" | "other";
  reliabilityHint?: number; // 0-1 rough signal only
  contentHash: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  return stripTags(m[1]).slice(0, 300) || null;
}

function extractMeta(html: string, nameOrProp: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${nameOrProp}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1].trim().slice(0, 500);
  }
  return null;
}

function extractCanonical(html: string): string | null {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return m?.[1]?.trim() || null;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/** Fetch a single URL with timeout and rich metadata extraction. */
export async function retrievePage(url: string, timeoutMs = 12000): Promise<RetrievedPage> {
  const retrievedAt = new Date().toISOString();
  if (!isHttpUrl(url)) {
    return {
      url,
      finalUrl: url,
      status: 0,
      title: null,
      text: "",
      contentHash: "",
      retrievedAt,
      error: "Only http/https URLs are allowed",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "AetherResearchBot/1.0 (+https://aether.local; research retrieval)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
    });
    const raw = await res.text();
    const title = extractTitle(raw);
    const text = stripTags(raw).slice(0, 50_000);
    const contentHash = await sha256Hex(text);

    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      title,
      text,
      contentHash,
      retrievedAt,
      canonicalUrl: extractCanonical(raw),
      publishedAt:
        extractMeta(raw, "article:published_time") ||
        extractMeta(raw, "datePublished") ||
        extractMeta(raw, "publish_date") ||
        null,
      updatedAt:
        extractMeta(raw, "article:modified_time") ||
        extractMeta(raw, "dateModified") ||
        null,
      description: extractMeta(raw, "description") || extractMeta(raw, "og:description"),
      language: extractMeta(raw, "language") || null,
    };
  } catch (err) {
    return {
      url,
      finalUrl: url,
      status: 0,
      title: null,
      text: "",
      contentHash: "",
      retrievedAt,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Build source metadata from a retrieved page (for storage / research_sources). */
export function toSourceMeta(page: RetrievedPage): ResearchSourceMeta {
  return {
    url: page.finalUrl || page.url,
    domain: domainFromUrl(page.finalUrl || page.url),
    title: page.title,
    retrievedAt: page.retrievedAt,
    publishedAt: page.publishedAt,
    sourceType: "web",
    contentHash: page.contentHash,
    reliabilityHint: page.status >= 200 && page.status < 300 && page.text.length > 200 ? 0.6 : 0.3,
  };
}

/** Simple duplicate detection by content hash or canonical URL. */
export function isDuplicate(
  candidate: ResearchSourceMeta,
  existing: ResearchSourceMeta[],
): boolean {
  return existing.some(
    (e) =>
      (candidate.contentHash && e.contentHash === candidate.contentHash) ||
      e.url === candidate.url,
  );
}
