/** Phase I — provider-independent retrieval/RAG primitives. */

export const EMBEDDING_DIMENSIONS = 384;
export type RetrievalMode = "lexical" | "semantic" | "hybrid" | "graph";

export interface EmbeddingProvider {
  provider: string;
  model: string;
  dimensions: number;
  embed(text: string): Promise<number[]>;
}

export interface RetrievalCandidate {
  id: string;
  entryId: string;
  chunkId?: string | null;
  versionId?: string | null;
  title: string;
  snippet: string;
  content: string;
  lexicalScore: number;
  semanticScore: number;
  metadataScore: number;
  graphScore: number;
  matchedTerms: string[];
  provenance: Record<string, unknown>;
}

const tokenize = (value: string) => Array.from(new Set(value.toLowerCase().normalize("NFKC").match(/[\p{L}\p{N}]{2,}/gu) ?? []));

/** Deterministic offline embedding fallback. Replace with a real provider adapter without changing retrieval contracts. */
export const deterministicEmbeddingProvider: EmbeddingProvider = {
  provider: "aether",
  model: "deterministic-hash-384-v1",
  dimensions: EMBEDDING_DIMENSIONS,
  async embed(text) {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    for (const token of tokenize(text)) {
      let hash = 2166136261;
      for (let i = 0; i < token.length; i += 1) hash = Math.imul(hash ^ token.charCodeAt(i), 16777619) >>> 0;
      const index = hash % EMBEDDING_DIMENSIONS;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[index] += sign * (1 + Math.min(token.length, 12) / 12);
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => value / norm);
  },
};

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return 0;
  return Math.max(-1, Math.min(1, dot / Math.sqrt(na * nb)));
}

export function lexicalScore(query: string, content: string): { score: number; matchedTerms: string[] } {
  const queryTerms = tokenize(query);
  const contentTerms = new Set(tokenize(content));
  const matchedTerms = queryTerms.filter((term) => contentTerms.has(term));
  return { score: queryTerms.length ? matchedTerms.length / queryTerms.length : 0, matchedTerms };
}

export function combineScores(input: { lexical: number; semantic: number; metadata: number; graph: number; mode: RetrievalMode }): number {
  const weights = input.mode === "lexical" ? [1, 0, 0, 0] : input.mode === "semantic" ? [0, 1, 0, 0] : input.mode === "graph" ? [0.15, 0.25, 0.1, 0.5] : [0.4, 0.4, 0.1, 0.1];
  return Math.max(0, Math.min(1, input.lexical * weights[0] + input.semantic * weights[1] + input.metadata * weights[2] + input.graph * weights[3]));
}

export function chunkText(content: string, maxCharacters = 1800, overlap = 180): string[] {
  const normalized = content.normalize("NFKC").replace(/\r/g, "").trim();
  if (!normalized) return [];
  if (normalized.length <= maxCharacters) return [normalized];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length && chunks.length < 500) {
    const end = Math.min(normalized.length, start + maxCharacters);
    const slice = normalized.slice(start, end);
    const boundary = end < normalized.length ? Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n")) : slice.length;
    const stop = boundary > maxCharacters * 0.55 ? start + boundary + 1 : end;
    chunks.push(normalized.slice(start, stop).trim());
    if (stop >= normalized.length) break;
    start = Math.max(start + 1, stop - Math.min(overlap, maxCharacters - 1));
  }
  return chunks.filter(Boolean);
}

export function buildRagContext(results: RetrievalCandidate[], maxCharacters = 12000): string {
  let output = "";
  for (const result of results) {
    const block = `[${result.rank ?? "?"}] ${result.title}\n${result.snippet}\nSource/version: ${String(result.provenance.source_url ?? result.provenance.version ?? "internal")}`;
    if ((output + block).length > maxCharacters) break;
    output += `${output ? "\n\n" : ""}${block}`;
  }
  return output;
}
