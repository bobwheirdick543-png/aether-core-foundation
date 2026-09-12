const KNOWLEDGE_SIGNAL = /\b(what is|who is|how does|how do|why does|why is|explain|tell me about|research|look up|learn about|everything about|latest|current|compare|difference between|meaning of|define|documentation|docs|how to)\b/i;
const STOP_WORDS = new Set(["what","who","how","does","do","why","is","are","the","a","an","and","or","of","to","for","in","on","about","tell","me","please","can","you","latest","current","explain","define","meaning","between"]);

export interface KnowledgeGapAssessment {
  shouldAcquire: boolean;
  confidence: number;
  subject: string;
  reason: string;
}

function terms(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length >= 4 && !STOP_WORDS.has(word)))].slice(0, 12);
}

export function assessKnowledgeGap(message: string, knownContent: string[] = []): KnowledgeGapAssessment {
  const normalized = message.trim().replace(/\s+/g, " ");
  const subject = normalized.slice(0, 300);
  if (normalized.length < 24) return { shouldAcquire: false, confidence: 0, subject, reason: "message-too-short" };
  if (!KNOWLEDGE_SIGNAL.test(normalized)) return { shouldAcquire: false, confidence: 0, subject, reason: "no-knowledge-signal" };

  const requestedTerms = terms(normalized);
  if (!requestedTerms.length) return { shouldAcquire: false, confidence: 0.1, subject, reason: "no-substantive-terms" };
  const corpus = knownContent.join(" ").toLowerCase();
  const covered = requestedTerms.filter((term) => corpus.includes(term)).length;
  const coverage = covered / requestedTerms.length;
  const confidence = Math.min(1, 0.55 + (1 - coverage) * 0.4);
  const shouldAcquire = coverage < 0.65;
  return { shouldAcquire, confidence, subject, reason: shouldAcquire ? "insufficient-approved-knowledge-coverage" : "sufficient-known-coverage" };
}
