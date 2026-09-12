import { describe, expect, it } from "vitest";
import { Z2_DEFAULT_MAX_INPUT_TOKENS, Z2_DEFAULT_MAX_OUTPUT_TOKENS, Z2_DEFAULT_MAX_TOKENS_PER_REQUEST, Z2_FREE_ACTIVE_KEY_LIMIT, Z2_FREE_MONTHLY_TOKENS, Z2_SECRET_LENGTH, hashZ2Secret, makeZ2Secret } from "../phase-z2-api";

describe("Phase Z2 Aether Intelligence API credential contract", () => {
  it("generates a globally random 64-character secret with the AAX generation prefix", () => {
    const first = makeZ2Secret(3, 1);
    const second = makeZ2Secret(3, 1);
    expect(first).toMatch(/^AAX-3\.1-[A-Za-z0-9_-]{64}$/);
    expect(second).toMatch(/^AAX-3\.1-[A-Za-z0-9_-]{64}$/);
    expect(first).not.toBe(second);
    expect(first.split("-").at(-1)?.length).toBe(Z2_SECRET_LENGTH);
  });

  it("uses the intended free-tier safety defaults", () => {
    expect(Z2_FREE_MONTHLY_TOKENS).toBe(200_000);
    expect(Z2_FREE_ACTIVE_KEY_LIMIT).toBe(5);
    expect(Z2_DEFAULT_MAX_TOKENS_PER_REQUEST).toBe(4096);
    expect(Z2_DEFAULT_MAX_INPUT_TOKENS).toBe(12_000);
    expect(Z2_DEFAULT_MAX_OUTPUT_TOKENS).toBe(4096);
  });

  it("hashes the complete secret and never exposes a reversible representation", () => {
    const secret = makeZ2Secret(2, 0);
    const hash = hashZ2Secret(secret);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(secret);
  });
});
