import { describe, expect, it } from "vitest";
import { buildRagContext, chunkText, combineScores, deterministicEmbeddingProvider, lexicalScore } from "../retrieval-engine";

describe("Phase I retrieval engine", () => {
  it("chunks long content with bounded overlap", () => {
    const chunks = chunkText("A".repeat(5000), 1000, 100);
    expect(chunks.length).toBeGreaterThan(4);
    expect(chunks.every((chunk) => chunk.length <= 1000)).toBe(true);
  });
  it("scores lexical matches deterministically", () => {
    const result = lexicalScore("Aether retrieval", "Aether provides retrieval and research");
    expect(result.score).toBe(1);
    expect(result.matchedTerms).toEqual(["aether", "retrieval"]);
  });
  it("produces normalized replaceable embeddings", async () => {
    const vector = await deterministicEmbeddingProvider.embed("knowledge graph retrieval");
    expect(vector).toHaveLength(384);
    expect(Math.sqrt(vector.reduce((s, v) => s + v * v, 0))).toBeCloseTo(1, 5);
  });
  it("combines mode-specific retrieval signals", () => {
    expect(combineScores({ lexical: 1, semantic: 0, metadata: 0, graph: 0, mode: "lexical" })).toBe(1);
    expect(combineScores({ lexical: 0, semantic: 1, metadata: 0, graph: 0, mode: "semantic" })).toBe(1);
    expect(combineScores({ lexical: 0, semantic: 0, metadata: 0, graph: 1, mode: "graph" })).toBe(0.5);
  });
  it("builds bounded RAG context with provenance", () => {
    const context = buildRagContext([{ entryId: "e1", title: "Knowledge", snippet: "Verified content", content: "Verified content", lexicalScore: 1, semanticScore: 1, metadataScore: 0, graphScore: 0, matchedTerms: [], provenance: { version: 2, source_url: "internal" } }], 1000);
    expect(context).toContain("[1] Knowledge");
    expect(context).toContain("Source/version: internal");
  });
});
