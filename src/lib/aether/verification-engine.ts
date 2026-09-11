/** Phase G — bounded, provider-independent verification engine. */

export type VerificationState =
  | "verified"
  | "needs_review"
  | "conflicting"
  | "unsupported"
  | "outdated"
  | "rejected"
  | "pending";

export interface VerificationSource {
  id: string;
  url?: string | null;
  title?: string | null;
  domain?: string | null;
  content?: string | null;
  snippet?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  retrievedAt?: string | null;
  qualityScore?: number | null;
  qualityFactors?: Record<string, unknown> | null;
  staleAt?: string | null;
}

export interface VerificationEvidence {
  sourceId: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
  excerpt: string;
  supportsClaim: boolean;
  evidenceStrength: number;
  authorityScore: number;
  freshnessScore: number;
  publishedAt: string | null;
  retrievedAt: string | null;
  reasons: string[];
}

export interface VerificationResult {
  claim: string;
  normalizedClaim: string;
  verificationState: VerificationState;
  confidence: number;
  evidenceStrength: number;
  authorityScore: number;
  freshnessScore: number;
  missingEvidence: boolean;
  contradictionCount: number;
  dateMismatchCount: number;
  uncertainty: string[];
  requiresReview: boolean;
  reviewReason: string | null;
  evidence: VerificationEvidence[];
}

const STOP_WORDS = new Set(
  "a an and are as at be by for from has have in is it of on or that the their this to was were with without into than then they them those these about after before during over under can could should would will may might must not no yes".split(" "),
);

function tokens(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[^a-z0-9%$.-]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
    ),
  );
}

export function normalizeClaim(claim: string): string {
  return tokens(claim).sort().join(" ");
}

function overlapScore(claim: string, text: string): number {
  const wanted = tokens(claim);
  if (!wanted.length) return 0;
  const available = new Set(tokens(text));
  return wanted.filter((token) => available.has(token)).length / wanted.length;
}

function hasNegation(value: string): boolean {
  return /\b(no|not|never|neither|without|false|denied|reject(?:ed|s)?|disput(?:ed|es|e)|incorrect|wrong)\b/i.test(value);
}

function extractYears(value: string): number[] {
  return Array.from(new Set((value.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number)));
}

function authorityScore(source: VerificationSource): number {
  const domain = (source.domain ?? "").toLowerCase();
  const url = (source.url ?? "").toLowerCase();
  if (/\.(gov|gov\.\w+)$/.test(domain) || domain.includes(".gov.")) return 1;
  if (domain.endsWith(".edu") || domain.includes(".ac.")) return 0.95;
  if (domain.endsWith(".org")) return 0.8;
  if (/who\.int|un\.org|oecd\.org|worldbank\.org|europa\.eu/.test(domain)) return 1;
  if (/doi\.org|pubmed|nature\.com|science\.org|springer|ieee\.org|acm\.org/.test(url + domain)) return 0.95;
  if (domain) return 0.6;
  return 0.4;
}

function freshnessScore(source: VerificationSource, now = Date.now()): number {
  const timestamp = source.updatedAt ?? source.publishedAt ?? source.retrievedAt;
  if (!timestamp) return 0.5;
  const ageDays = Math.max(0, (now - Date.parse(timestamp)) / 86_400_000);
  if (!Number.isFinite(ageDays)) return 0.5;
  if (source.staleAt && Date.parse(source.staleAt) <= now) return 0.15;
  if (ageDays <= 30) return 1;
  if (ageDays <= 180) return 0.85;
  if (ageDays <= 365) return 0.7;
  if (ageDays <= 730) return 0.45;
  return 0.25;
}

function evidenceExcerpt(claim: string, source: VerificationSource): string {
  const text = (source.content || source.snippet || "").replace(/\s+/g, " ").trim();
  if (text.length <= 900) return text;
  const wanted = tokens(claim);
  let best = 0;
  let bestIndex = 0;
  for (const token of wanted) {
    const index = text.toLowerCase().indexOf(token);
    if (index >= 0 && (bestIndex === 0 || index < bestIndex)) bestIndex = index;
  }
  const start = Math.max(0, bestIndex - 250);
  return text.slice(start, start + 900);
}

function evaluateSource(claim: string, source: VerificationSource, now: number): VerificationEvidence | null {
  const text = `${source.title ?? ""}\n${source.content ?? source.snippet ?? ""}`.trim();
  if (!text) return null;
  const overlap = overlapScore(claim, text);
  if (overlap < 0.25) return null;
  const negated = hasNegation(evidenceExcerpt(claim, source));
  const supportsClaim = !negated;
  const authority = authorityScore(source);
  const freshness = freshnessScore(source, now);
  const strength = Math.min(1, overlap * 0.65 + authority * 0.2 + freshness * 0.15);
  const reasons = [`term-overlap:${overlap.toFixed(2)}`, `authority:${authority.toFixed(2)}`, `freshness:${freshness.toFixed(2)}`];
  if (negated) reasons.push("negation-detected");
  return {
    sourceId: source.id,
    sourceUrl: source.url ?? null,
    sourceTitle: source.title ?? null,
    excerpt: evidenceExcerpt(claim, source),
    supportsClaim,
    evidenceStrength: strength,
    authorityScore: authority,
    freshnessScore: freshness,
    publishedAt: source.publishedAt ?? null,
    retrievedAt: source.retrievedAt ?? null,
    reasons,
  };
}

export function verifyClaim(claim: string, sources: VerificationSource[], now = Date.now()): VerificationResult {
  const clean = claim.trim();
  if (!clean) throw new Error("Claim is required");
  const normalizedClaim = normalizeClaim(clean);
  const evidence = sources.map((source) => evaluateSource(clean, source, now)).filter(Boolean) as VerificationEvidence[];
  const supporting = evidence.filter((item) => item.supportsClaim);
  const contradicting = evidence.filter((item) => !item.supportsClaim);
  const uncertainty: string[] = [];
  const claimYears = extractYears(clean);
  const dateMismatches = evidence.filter((item) => {
    const sourceYears = extractYears(`${item.sourceTitle ?? ""} ${item.excerpt}`);
    return claimYears.length > 0 && sourceYears.length > 0 && !claimYears.some((year) => sourceYears.includes(year));
  });
  if (!evidence.length) uncertainty.push("No sufficiently relevant evidence was found in the supplied research sources.");
  if (contradicting.length) uncertainty.push("At least one relevant source contains a contradiction or negation.");
  if (dateMismatches.length) uncertainty.push("Relevant evidence contains dates that do not match the claim.");
  if (evidence.some((item) => item.freshnessScore < 0.4)) uncertainty.push("Some relevant evidence is old or stale.");

  const avg = (items: VerificationEvidence[], key: keyof Pick<VerificationEvidence, "evidenceStrength" | "authorityScore" | "freshnessScore">) =>
    items.length ? items.reduce((sum, item) => sum + item[key], 0) / items.length : 0;
  const evidenceStrength = avg(supporting.length ? supporting : evidence, "evidenceStrength");
  const authority = avg(supporting.length ? supporting : evidence, "authorityScore");
  const freshness = avg(supporting.length ? supporting : evidence, "freshnessScore");
  const agreement = supporting.length ? Math.min(1, supporting.length / Math.max(1, Math.min(3, sources.length))) : 0;
  const confidence = Math.min(1, agreement * 0.45 + evidenceStrength * 0.25 + authority * 0.2 + freshness * 0.1);

  let verificationState: VerificationState = "needs_review";
  let reviewReason: string | null = null;
  if (!evidence.length) {
    verificationState = "unsupported";
    reviewReason = "No relevant evidence.";
  } else if (contradicting.length && supporting.length) {
    verificationState = "conflicting";
    reviewReason = "Supporting and contradictory evidence are both present.";
  } else if (contradicting.length && !supporting.length) {
    verificationState = "rejected";
    reviewReason = "Relevant evidence contradicts the claim.";
  } else if (dateMismatches.length) {
    verificationState = "needs_review";
    reviewReason = "Evidence dates do not match the claim.";
  } else if (freshness < 0.4) {
    verificationState = "outdated";
    reviewReason = "Relevant evidence is stale or materially old.";
  } else if (supporting.length >= 2 && confidence >= 0.72) {
    verificationState = "verified";
  } else {
    verificationState = "needs_review";
    reviewReason = supporting.length === 1 ? "Only one relevant source supports the claim." : "Evidence quality is below the automatic verification threshold.";
  }

  return {
    claim: clean,
    normalizedClaim,
    verificationState,
    confidence,
    evidenceStrength,
    authorityScore: authority,
    freshnessScore: freshness,
    missingEvidence: evidence.length === 0,
    contradictionCount: contradicting.length,
    dateMismatchCount: dateMismatches.length,
    uncertainty,
    requiresReview: verificationState !== "verified",
    reviewReason,
    evidence,
  };
}

export function verifyClaims(claims: string[], sources: VerificationSource[], now = Date.now()): VerificationResult[] {
  return claims.map((claim) => verifyClaim(claim, sources, now));
}
