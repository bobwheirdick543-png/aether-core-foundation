import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AETHER_MEMORY_RELEVANCE_THRESHOLD, AETHER_SHORT_TERM_CHAR_BUDGET, AETHER_SHORT_TERM_MESSAGE_LIMIT } from "./aether-memory-governance";

const root = resolve(process.cwd());
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Phase E completion gate", () => {
  it("has bounded short-term context constants and a relevance threshold", () => {
    expect(AETHER_SHORT_TERM_MESSAGE_LIMIT).toBe(40);
    expect(AETHER_SHORT_TERM_CHAR_BUDGET).toBeGreaterThan(0);
    expect(AETHER_MEMORY_RELEVANCE_THRESHOLD).toBeGreaterThan(0);
    expect(AETHER_MEMORY_RELEVANCE_THRESHOLD).toBeLessThan(1);
  });

  it("exposes authenticated memory export and a user-facing export control", () => {
    const route = read("src/routes/api/aax/memory/export.ts");
    const page = read("src/routes/_authenticated/memory/export.tsx");
    expect(route).toContain("middleware: [requireSupabaseAuth]");
    expect(route).toContain("aether_memories");
    expect(route).toContain("aether_memory_events");
    expect(route).toContain("content-disposition");
    expect(page).toContain("/api/aax/memory/export");
    expect(page).toContain("Download JSON export");
  });

  it("keeps sensitive content out of automatic persistence", () => {
    const governance = read("src/lib/aether/aether-memory-governance.ts");
    expect(governance).toContain("persistenceAllowed: !sensitive");
    expect(governance).toContain("private key");
    expect(governance).toContain("one[- ]time password");
  });

  it("keeps the existing chat history bound aligned with Phase E", () => {
    const chat = read("src/lib/aether/aax-chat.functions.ts");
    expect(chat).toContain("const MAX_HISTORY_MESSAGES = 40");
  });

  it("contains explicit evaluation coverage for relevance, staleness, contradiction and deletion", () => {
    const tests = read("src/lib/aether/aether-memory-governance.test.ts");
    const memoryTests = read("src/lib/aether/aether-phase-e.test.ts");
    expect(tests).toContain("scores relevant memories");
    expect(tests).toContain("stale memory");
    expect(tests).toContain("contradiction");
    expect(memoryTests).toContain("deleted");
  });
});
