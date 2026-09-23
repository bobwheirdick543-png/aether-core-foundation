import { afterEach, describe, expect, it } from "vitest";
import { decryptZ2Secret, encryptZ2Secret, makeZ2Secret } from "../phase-z2-api.crypto";

describe("AAX secret crypto", () => {
  const original = process.env.AETHER_API_KEY_ENCRYPTION_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.AETHER_API_KEY_ENCRYPTION_KEY;
    else process.env.AETHER_API_KEY_ENCRYPTION_KEY = original;
  });

  it("generates the documented AAX secret format", () => {
    process.env.AETHER_API_KEY_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
    const secret = makeZ2Secret(1, 0);
    expect(secret).toMatch(/^AAX-1\.0-[A-Za-z0-9_-]{64}$/);
  });

  it("round-trips a generated secret through version 2 encryption", () => {
    process.env.AETHER_API_KEY_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
    const secret = makeZ2Secret(1, 0);
    const encrypted = encryptZ2Secret(secret);
    expect(encrypted.startsWith("2.")).toBe(true);
    expect(decryptZ2Secret(encrypted)).toBe(secret);
  });
});
