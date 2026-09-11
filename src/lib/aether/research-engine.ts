/**
 * AETHER NATIVE WEB RESEARCH ENGINE
 *
 * Retrieval + extraction only. No external AI provider required and no
 * fabricated findings. Phase F adds bounded retrieval, redirect handling,
 * retry classification, content validation, robots policy, URL normalization,
 * change detection and explicit source-quality signals.
 */

export type RetrievalFailureClass =
  | "invalid_url"
  | "blocked"
  | "robots_denied"
  | "unsupported_content_type"
  | "response_too_large"
  | "timeout"
  | "dns_or_network"
  | "http_4xx"
  | "http_5xx"
  | "rate_limited"
  | "parse_error";

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
  contentType?: string | null;
  contentLength?: number | null;
  redirectCount?: number;
  attempts?: number;
  robotsAllowed?: boolean;
  stale?: boolean;
  failureClass?: RetrievalFailureClass;
  error?: string;
}

export interface ResearchSourceMeta {
  url: string;
  domain: string;
  title: string | null;
  retrievedAt: string;
  publishedAt?: string | null;
  sourceType: "web" | "document" | "upload" | "other";
  reliabilityHint?: number;
  contentHash: string;
}

export interface RetrieveOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  maxRetries?: number;
  userAgent?: string;
  respectRobots?: boolean;
  staleAfterDays?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_USER_AGENT = "AetherResearchBot/1.0 (+https://aether.ai; research retrieval)";
const ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml", "text/plain", "application/json"];
const RETRYABLE_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRACKING_KEYS = /^(utm_[^=]*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|ref|ref_src)$/i;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
      .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
      .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\\s+/g, " ").trim();
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i);
  return m?.[1] ? stripTags(m[1]).slice(0, 300) || null : null;
}

function extractMeta(html: string, nameOrProp: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${nameOrProp}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]).trim().slice(0, 500);
  }
  return null;
}

function extractCanonical(html: string, baseUrl: string): string | null {
  const m = html.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/i);
  if (!m?.[1]) return null;
  try { return normalizeUrl(new URL(m[1], baseUrl).toString()); } catch { return null; }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && !isPrivateHost(u.hostname);
  } catch { return false; }
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/[\\[\\]]/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1") return true;
  if (/^127(?:\\.\\d{1,3}){3}$/.test(host) || /^10(?:\\.\\d{1,3}){3}$/.test(host) || /^192\\.168(?:\\.\\d{1,3}){2}$/.test(host)) return true;
  const m = host.match(/^172\\.(\\d{1,3})\\.\\d{1,3}\\.\\d{1,3}$/);
  return Boolean(m && Number(m[1]) >= 16 && Number(m[1]) <= 31);
}

export function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (TRACKING_KEYS.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  url.pathname = url.pathname.replace(/\\/{2,}/g, "/");
  return url.toString().replace(/\\/$/, "");
}

export function domainFromUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\\./, "").toLowerCase(); } catch { return "unknown"; }
}

function failureForStatus(status: number): RetrievalFailureClass {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "http_5xx";
  return "http_4xx";
}

function retryDelayMs(attempt: number): number { return Math.min(4_000, 400 * 2 ** attempt); }

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw Object.assign(new Error(`Response exceeds ${maxBytes} byte limit`), { failureClass: "response_too_large" as const });
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw Object.assign(new Error("Response exceeds byte limit"), { failureClass: "response_too_large" as const });
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw Object.assign(new Error(`Response exceeds ${maxBytes} byte limit`), { failureClass: "response_too_large" as const });
        }
        chunks.push(value);
      }
    }
  } finally { reader.releaseLock(); }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function robotsAllowed(url: string, userAgent: string, timeoutMs: number): Promise<boolean> {
  try {
    const target = new URL(url);
    const robotsUrl = `${target.origin}/robots.txt`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 5_000));
    try {
      const response = await fetch(robotsUrl, { headers: { "User-Agent": userAgent }, signal: controller.signal });
      if (response.status === 404) return true;
      if (!response.ok) return true;
      const text = await response.text();
      const lines = text.split(/\\r?\\n/).map((line) => line.trim());
      let active = false;
      let denied = false;
      for (const line of lines) {
        if (!line || line.startsWith("#")) continue;
        const [rawKey, rawValue = ""] = line.split(":", 2);
        const key = rawKey.trim().toLowerCase();
        const value = rawValue.trim();
        if (key === "user-agent") active = value === "*" || userAgent.toLowerCase().includes(value.toLowerCase());
        if (active && key === "disallow" && value) {
          try {
            const path = new URL(value, target.origin).pathname;
            if (target.pathname.startsWith(path)) denied = true;
          } catch { /* ignore malformed robots rules */ }
        }
      }
      return !denied;
    } finally { clearTimeout(timer); }
  } catch { return true; }
}

async function fetchWithRedirects(startUrl: string, options: Required<RetrieveOptions>): Promise<{ response: Response; finalUrl: string; redirectCount: number }> {
  let current = normalizeUrl(startUrl);
  let redirectCount = 0;
  for (;;) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await fetch(current, { method: "GET", redirect: "manual", signal: controller.signal, headers: { "User-Agent": options.userAgent, Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8" } });
      if (![301,302,303,307,308].includes(response.status)) return { response, finalUrl: current, redirectCount };
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: current, redirectCount };
      if (++redirectCount > options.maxRedirects) throw Object.assign(new Error("Redirect limit exceeded"), { failureClass: "blocked" as const });
      current = normalizeUrl(new URL(location, current).toString());
      if (!isHttpUrl(current)) throw Object.assign(new Error("Redirect target is not allowed"), { failureClass: "blocked" as const });
    } finally { clearTimeout(timer); }
  }
}

export async function retrievePage(url: string, optionsOrTimeout: RetrieveOptions | number = {}): Promise<RetrievedPage> {
  const options: Required<RetrieveOptions> = {
    timeoutMs: typeof optionsOrTimeout === "number" ? optionsOrTimeout : optionsOrTimeout.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxBytes: typeof optionsOrTimeout === "number" ? DEFAULT_MAX_BYTES : optionsOrTimeout.maxBytes ?? DEFAULT_MAX_BYTES,
    maxRedirects: typeof optionsOrTimeout === "number" ? DEFAULT_MAX_REDIRECTS : optionsOrTimeout.maxRedirects ?? DEFAULT_MAX_REDIRECTS,
    maxRetries: typeof optionsOrTimeout === "number" ? DEFAULT_MAX_RETRIES : optionsOrTimeout.maxRetries ?? DEFAULT_MAX_RETRIES,
    userAgent: typeof optionsOrTimeout === "number" ? DEFAULT_USER_AGENT : optionsOrTimeout.userAgent ?? DEFAULT_USER_AGENT,
    respectRobots: typeof optionsOrTimeout === "number" ? true : optionsOrTimeout.respectRobots ?? true,
    staleAfterDays: typeof optionsOrTimeout === "number" ? 30 : optionsOrTimeout.staleAfterDays ?? 30,
  };
  const retrievedAt = new Date().toISOString();
  if (!isHttpUrl(url)) return { url, finalUrl: url, status: 0, title: null, text: "", contentHash: "", retrievedAt, failureClass: "invalid_url", error: "Only public http/https URLs are allowed" };
  const normalizedUrl = normalizeUrl(url);
  if (options.respectRobots && !(await robotsAllowed(normalizedUrl, options.userAgent, options.timeoutMs))) return { url, finalUrl: normalizedUrl, status: 0, title: null, text: "", contentHash: "", retrievedAt, robotsAllowed: false, failureClass: "robots_denied", error: "Retrieval disallowed by robots.txt" };

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt++) {
    try {
      const { response, finalUrl, redirectCount } = await fetchWithRedirects(normalizedUrl, options);
      const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
      if (!response.ok) {
        const failureClass = failureForStatus(response.status);
        if (RETRYABLE_HTTP.has(response.status) && attempt <= options.maxRetries) { await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt - 1))); continue; }
        return { url, finalUrl, status: response.status, title: null, text: "", contentHash: "", retrievedAt, contentType, redirectCount, attempts: attempt, failureClass, error: `HTTP ${response.status}` };
      }
      if (!ALLOWED_CONTENT_TYPES.includes(contentType)) return { url, finalUrl, status: response.status, title: null, text: "", contentHash: "", retrievedAt, contentType, redirectCount, attempts: attempt, failureClass: "unsupported_content_type", error: `Unsupported content type: ${contentType || "unknown"}` };
      const raw = await readBoundedBody(response, options.maxBytes);
      const title = extractTitle(raw);
      const text = stripTags(raw).slice(0, 80_000);
      if (!text) return { url, finalUrl, status: response.status, title, text: "", contentHash: "", retrievedAt, contentType, contentLength: new TextEncoder().encode(raw).byteLength, redirectCount, attempts: attempt, failureClass: "parse_error", error: "No readable text extracted" };
      const contentHash = await sha256Hex(text);
      const canonicalUrl = extractCanonical(raw, finalUrl);
      const staleBase = extractMeta(raw, "article:published_time") || extractMeta(raw, "datePublished") || null;
      const staleDate = staleBase ? Date.parse(staleBase) : Date.parse(retrievedAt);
      const stale = Number.isFinite(staleDate) && staleDate < Date.now() - options.staleAfterDays * 86_400_000;
      return {
        url,
        finalUrl,
        status: response.status,
        title,
        text,
        contentHash,
        retrievedAt,
        canonicalUrl,
        publishedAt: staleBase,
        updatedAt: extractMeta(raw, "article:modified_time") || extractMeta(raw, "dateModified") || null,
        description: extractMeta(raw, "description") || extractMeta(raw, "og:description"),
        language: extractMeta(raw, "language") || null,
        contentType,
        contentLength: new TextEncoder().encode(raw).byteLength,
        redirectCount,
        attempts: attempt,
        robotsAllowed: true,
        stale,
      };
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : "Fetch failed";
      const failureClass = (err as { failureClass?: RetrievalFailureClass })?.failureClass
        ?? (err instanceof DOMException && err.name === "AbortError" ? "timeout" : "dns_or_network");
      if (attempt <= options.maxRetries) { await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt - 1))); continue; }
      return { url, finalUrl: normalizedUrl, status: 0, title: null, text: "", contentHash: "", retrievedAt, attempts: attempt, failureClass, error: message };
    }
  }
  return { url, finalUrl: normalizedUrl, status: 0, title: null, text: "", contentHash: "", retrievedAt, failureClass: "dns_or_network", error: lastError instanceof Error ? lastError.message : "Fetch failed" };
}

export function sourceQualityScore(page: RetrievedPage): { score: number; factors: Record<string, number> } {
  if (page.error || !page.text) return { score: 0, factors: { retrieval: 0 } };
  const retrieval = page.status >= 200 && page.status < 300 ? 1 : 0;
  const content = Math.min(1, page.text.length / 4000);
  const metadata = [page.title, page.canonicalUrl, page.publishedAt || page.updatedAt, page.description].filter(Boolean).length / 4;
  const freshness = page.stale ? 0.4 : 1;
  const score = Math.min(1, retrieval * 0.45 + content * 0.25 + metadata * 0.15 + freshness * 0.15);
  return { score: Number(score.toFixed(4)), factors: { retrieval, content, metadata, freshness } };
}

export function toSourceMeta(page: RetrievedPage): ResearchSourceMeta {
  const quality = sourceQualityScore(page);
  return { url: normalizeUrl(page.finalUrl || page.url), domain: domainFromUrl(page.finalUrl || page.url), title: page.title, retrievedAt: page.retrievedAt, publishedAt: page.publishedAt, sourceType: "web", contentHash: page.contentHash, reliabilityHint: quality.score };
}

export function isDuplicate(candidate: ResearchSourceMeta, existing: ResearchSourceMeta[]): boolean {
  return existing.some((e) => (candidate.contentHash && e.contentHash === candidate.contentHash) || normalizeUrl(e.url) === normalizeUrl(candidate.url));
}
