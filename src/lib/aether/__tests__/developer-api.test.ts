import { describe, expect, it } from "vitest";
import { API_SCOPES, hashSecret, normalizeScopeList } from "../developer-api";

describe("Phase S developer API", () => {
  it("hashes secrets deterministically without exposing plaintext", () => {
    expect(hashSecret("aether_sk_example")).toBe(hashSecret("aether_sk_example"));
    expect(hashSecret("aether_sk_example")).not.toBe("aether_sk_example");
  });
  it("accepts only known scopes and de-duplicates them", () => {
    const scopes = normalizeScopeList(["tasks:read", "tasks:read", "not-a-scope", "runs:read"]);
    expect(scopes).toEqual(["tasks:read", "runs:read"]);
    expect(API_SCOPES).toContain("battleversia:read");
    // Final validation run against the current main tree.
  });
});
