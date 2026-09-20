import { createCipheriv, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { decryptZ2Secret, encryptZ2Secret, makeZ2Secret } from "./phase-z2-api.crypto";

describe("AAX API key generation", () => {
  beforeEach(() => {
    process.env.AETHER_API_KEY_ENCRYPTION_KEY = "aether-test-encryption-secret";
  });

  it("preserves the AAX generation format and produces unique secrets", () => {
    const keys = Array.from({ length: 1000 }, () => makeZ2Secret(1, 0));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => /^AAX-1\.0-[A-Za-z0-9_-]{64}$/.test(key))).toBe(true);
  });

  it("encrypts and decrypts with any non-empty operator secret", () => {
    const secret = makeZ2Secret(1, 0);
    const encrypted = encryptZ2Secret(secret);

    expect(encrypted.startsWith("2.")).toBe(true);
    expect(decryptZ2Secret(encrypted)).toBe(secret);
  });

  it("also works with a 32-byte hexadecimal deployment secret", () => {
    process.env.AETHER_API_KEY_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    const secret = makeZ2Secret(2, 0);
    expect(decryptZ2Secret(encryptZ2Secret(secret))).toBe(secret);
  });

  it("continues to decrypt legacy v1 secrets", () => {
    const key = Buffer.from("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "hex");
    process.env.AETHER_API_KEY_ENCRYPTION_KEY = key.toString("hex");
    const secret = makeZ2Secret(1, 0);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const legacy = `1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;

    expect(decryptZ2Secret(legacy)).toBe(secret);
  });

  it("never uses the removed exact-32-byte validation", () => {
    process.env.AETHER_API_KEY_ENCRYPTION_KEY = "short-but-non-empty";
    expect(() => encryptZ2Secret(makeZ2Secret(1, 0))).not.toThrow(
      /must encode exactly 32 bytes/,
    );
  });
});
