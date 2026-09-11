export type MemoryEvaluationInput = { content: string; query: string; importance?: number | null; confidence?: number | null; updatedAt?: string | null; status?: string };

const STOP_WORDS = new Set(["the","and","for","with","that","this","from","your","have","are","was","were","into","about","what","when","where","which","will","would","could","should"]);
const TERMS = (value: string) => Array.from(new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length >= 3 && !STOP_WORDS.has(term))));

export function scoreAetherMemory(input: MemoryEvaluationInput, now = Date.now()) {
  const queryTerms = TERMS(input.query);
  const content = input.content.toLowerCase();
  const hits = queryTerms.reduce((count, term) => count + (content.includes(term) ? 1 : 0), 0);
  const lexical = queryTerms.length ? hits / queryTerms.length : 0;
  const importance = Math.max(0, Math.min(1, Number(input.importance ?? 0.5)));
  const confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0.5)));
  const ageDays = input.updatedAt ? Math.max(0, (now - Date.parse(input.updatedAt)) / 86_400_000) : 0;
  const freshness = ageDays <= 30 ? 1 : ageDays >= 365 ? 0.35 : 1 - ((ageDays - 30) / 335) * 0.65;
  return lexical * 0.60 + importance * 0.20 + confidence * 0.10 + freshness * 0.10;
}

export const AETHER_MEMORY_RELEVANCE_THRESHOLD = 0.12;
export const AETHER_SHORT_TERM_MESSAGE_LIMIT = 40;
export const AETHER_SHORT_TERM_CHAR_BUDGET = 120_000;

const SENSITIVE_PATTERNS = [
  /\b(?:password|passwd|passcode|secret key|private key|api key)\b/i,
  /\b(?:seed phrase|recovery phrase|mnemonic)\b/i,
  /\b(?:credit card|debit card)\b.*\b\d{12,19}\b/i,
  /\b(?:ssn|social security number)\b/i,
  /\b(?:one[- ]time password|otp|verification code)\b/i,
];

export function classifyAetherMemoryContent(content: string) {
  const sensitive = SENSITIVE_PATTERNS.some((pattern) => pattern.test(content));
  return { sensitive, persistenceAllowed: !sensitive, reason: sensitive ? "Sensitive credential/payment/recovery content is not eligible for automatic durable persistence." : null };
}

export function buildBoundedShortTermContext<T extends { role?: string; content?: string }>(messages: T[], maxMessages = AETHER_SHORT_TERM_MESSAGE_LIMIT, maxChars = AETHER_SHORT_TERM_CHAR_BUDGET) {
  const selected: T[] = [];
  let chars = 0;
  for (let index = messages.length - 1; index >= 0 && selected.length < maxMessages; index -= 1) {
    const message = messages[index];
    const content = String(message.content ?? "");
    if (chars + content.length > maxChars && selected.length > 0) break;
    selected.push(message);
    chars += content.length;
  }
  return selected.reverse();
}

export function evaluateAetherMemoryRelevance(memory: MemoryEvaluationInput, query: string) {
  return scoreAetherMemory({ ...memory, query });
}

export function evaluateAetherMemoryStaleness(updatedAt: string, now = Date.now()) {
  const ageDays = Math.max(0, (now - Date.parse(updatedAt)) / 86_400_000);
  return { ageDays, stale: ageDays >= 365, veryStale: ageDays >= 730 };
}

export function detectAetherMemoryContradiction(a: string, b: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const left = normalize(a); const right = normalize(b);
  if (!left || !right || left === right) return false;
  const oppositePairs: [RegExp, RegExp][] = [[/\bdo not\b/, /\bdo\b/], [/\bnot\b/, /\bis\b/], [/\bnever\b/, /\balways\b/], [/\bdisable\b/, /\benable\b/], [/\boff\b/, /\bon\b/]];
  return oppositePairs.some(([negative, positive]) => (negative.test(left) && positive.test(right)) || (negative.test(right) && positive.test(left)));
}
