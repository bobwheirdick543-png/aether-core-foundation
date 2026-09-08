/**
 * Native web research helpers — retrieval + extraction only.
 * No external AI provider. No fabricated findings.
 */

export interface RetrievedPage {
  url: string;
  finalUrl: string;
  status: number;
  title: string | null;
  text: string;
  contentHash: string;
  retrievedAt: string;
  error?: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  return stripTags(m[1]).slice(0, 300) || null;
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

/** Fetch a single URL with timeout. Returns structured extraction or error. */
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
