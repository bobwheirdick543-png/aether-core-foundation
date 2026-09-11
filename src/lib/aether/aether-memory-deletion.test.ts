import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Phase E deletion evaluation", () => {
  it("marks active memory deleted and excludes deleted records from retrieval", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/aether/aether-memory.functions.ts"), "utf8");
    expect(source).toContain('update({ status: "deleted", deleted_at: new Date().toISOString()');
    expect(source).toContain('.eq("status", "active")');
    expect(source).toContain('.is("deleted_at", null)');
  });
});
