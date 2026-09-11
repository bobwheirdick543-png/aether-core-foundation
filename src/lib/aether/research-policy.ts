/**
 * Phase F access-policy primitives.
 *
 * These helpers deliberately do not bypass robots.txt, authentication, or
 * technical restrictions. They provide bounded concurrency and per-domain
 * pacing for research plans so the native engine never becomes an
 * unrestricted crawler.
 */

export type ResearchPolicyDecision =
  | { allowed: true; waitMs: 0 }
  | { allowed: false; waitMs: number; reason: "domain_rate_limit" | "global_concurrency" };

export type ResearchPolicyOptions = {
  maxConcurrent?: number;
  minDomainIntervalMs?: number;
  maxDomainEntries?: number;
};

const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_MIN_DOMAIN_INTERVAL_MS = 350;
const DEFAULT_MAX_DOMAIN_ENTRIES = 256;

function domainOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

function abortError(): DOMException {
  return new DOMException("Research cancelled", "AbortError");
}

/**
 * Small in-process limiter used by a single durable research worker.
 * Persistence of actual policy events belongs in Supabase; this class only
 * decides whether a worker must wait before issuing more work.
 */
export class ResearchAccessLimiter {
  private readonly maxConcurrent: number;
  private readonly minDomainIntervalMs: number;
  private readonly maxDomainEntries: number;
  private active = 0;
  private readonly lastStarted = new Map<string, number>();

  constructor(options: ResearchPolicyOptions = {}) {
    this.maxConcurrent = Math.max(1, Math.floor(options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT));
    this.minDomainIntervalMs = Math.max(0, Math.floor(options.minDomainIntervalMs ?? DEFAULT_MIN_DOMAIN_INTERVAL_MS));
    this.maxDomainEntries = Math.max(8, Math.floor(options.maxDomainEntries ?? DEFAULT_MAX_DOMAIN_ENTRIES));
  }

  inspect(url: string, now = Date.now()): ResearchPolicyDecision {
    const domain = domainOf(url);
    if (this.active >= this.maxConcurrent) {
      return { allowed: false, waitMs: 50, reason: "global_concurrency" };
    }
    const previous = this.lastStarted.get(domain);
    if (previous !== undefined) {
      const remaining = this.minDomainIntervalMs - (now - previous);
      if (remaining > 0) return { allowed: false, waitMs: remaining, reason: "domain_rate_limit" };
    }
    return { allowed: true, waitMs: 0 };
  }

  start(url: string, now = Date.now()): ResearchPolicyDecision {
    const decision = this.inspect(url, now);
    if (!decision.allowed) return decision;
    this.active += 1;
    const domain = domainOf(url);
    // Refresh insertion order when a domain is reused so trimming evicts the
    // least recently started domains rather than a frequently used domain.
    this.lastStarted.delete(domain);
    this.lastStarted.set(domain, now);
    this.trimDomains();
    return decision;
  }

  finish(): void {
    this.active = Math.max(0, this.active - 1);
  }

  /** Wait until a request is allowed, then claim one concurrency slot. */
  async acquire(url: string, signal?: AbortSignal): Promise<void> {
    for (;;) {
      if (signal?.aborted) throw abortError();
      const decision = this.start(url);
      if (decision.allowed) return;
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const onAbort = () => {
          if (timer) clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          reject(abortError());
        };
        timer = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, Math.max(1, decision.waitMs));
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    }
  }

  get activeCount(): number { return this.active; }
  get maxConcurrency(): number { return this.maxConcurrent; }

  private trimDomains(): void {
    while (this.lastStarted.size > this.maxDomainEntries) {
      const oldest = this.lastStarted.keys().next().value as string | undefined;
      if (!oldest) break;
      this.lastStarted.delete(oldest);
    }
  }
}

export function classifyRetryableStatus(status: number): boolean {
  return [408, 425, 429, 500, 502, 503, 504].includes(status);
}

export function retryBackoffMs(attempt: number, random = Math.random): number {
  const boundedAttempt = Math.max(0, Math.floor(attempt));
  const base = Math.min(8_000, 400 * 2 ** boundedAttempt);
  const jitter = Math.floor(Math.max(0, Math.min(1, random)) * Math.max(1, base * 0.25));
  return Math.min(10_000, base + jitter);
}

export function contentChangeState(previousHash: string | null | undefined, currentHash: string): "new" | "unchanged" | "changed" {
  if (!previousHash) return "new";
  return previousHash === currentHash ? "unchanged" : "changed";
}

export function unmetSourceRequirements(sourceCount: number, domainCount: number, requirements: { minSources: number; minDomains: number }): string[] {
  const unmet: string[] = [];
  if (sourceCount < requirements.minSources) unmet.push(`minimum sources not met: ${sourceCount}/${requirements.minSources}`);
  if (domainCount < requirements.minDomains) unmet.push(`minimum domains not met: ${domainCount}/${requirements.minDomains}`);
  return unmet;
}
