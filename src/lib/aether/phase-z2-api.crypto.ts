import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

export const Z2_SECRET_LENGTH = 64;

function encryptionKey(): Buffer {
  const raw = process.env.AETHER_API_KEY_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("Missing server configuration: AETHER_API_KEY_ENCRYPTION_KEY");
  }

  // Accept any non-empty operator secret and deterministically derive the
  // 32-byte AES-256 key required by GCM. This avoids coupling deployments to
  // one particular secret encoding/length while keeping encryption stable.
  const ikm = /^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "utf8");

  if (ikm.length < 1) {
    throw new Error("AETHER_API_KEY_ENCRYPTION_KEY is empty");
  }

  return Buffer.from(
    hkdfSync("sha256", ikm, Buffer.alloc(0), Buffer.from("aether-aax-api-keys-v2"), 32),
  );
}

function legacyEncryptionKey(): Buffer | null {
  const raw = process.env.AETHER_API_KEY_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");

  const decoded = Buffer.from(raw, "base64url");
  return decoded.length === 32 ? decoded : null;
}

export function encryptZ2Secret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `2.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptZ2Secret(value: string): string {
  const [version, ivText, tagText, ciphertextText] = value.split(".");
  if (!ivText || !tagText || !ciphertextText || (version !== "1" && version !== "2")) {
    throw new Error("Invalid encrypted API key secret");
  }

  const ciphertext = Buffer.from(ciphertextText, "base64url");
  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");

  const decryptWith = (key: Buffer) => {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  };

  // New v2 records use the derived key. Existing v1 records are first tried
  // with the same derivation and then with the legacy raw 32-byte secret.
  try {
    return decryptWith(encryptionKey());
  } catch (derivedError) {
    if (version !== "1") throw derivedError;
    const legacy = legacyEncryptionKey();
    if (!legacy) throw derivedError;
    return decryptWith(legacy);
  }
}

export function makeZ2Secret(modelGeneration: number, modelRevision: number): string {
  const version = `${modelGeneration}.${modelRevision}`;
  const secret = randomBytes(48).toString("base64url");
  if (secret.length !== Z2_SECRET_LENGTH) throw new Error("Z2 secret generator produced an invalid length");
  return `AAX-${version}-${secret}`;
}
