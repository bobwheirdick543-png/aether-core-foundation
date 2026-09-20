import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderCredentialPurpose = "aax_inference" | "knowledge_research";

function encryptionKey(): Buffer {
  // Accept any non-empty server secret. Always derive a stable 32-byte AES key via HKDF
  // so operators are not forced to supply exactly 32 raw bytes (hex/base64).
  const raw =
    process.env.AETHER_PROVIDER_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    process.env.AETHER_API_KEY_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "Missing server configuration: AETHER_API_KEY_ENCRYPTION_KEY (or AETHER_PROVIDER_CREDENTIAL_ENCRYPTION_KEY). Set any strong secret in Vercel and redeploy.",
    );
  }

  let ikm: Buffer;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length % 2 === 0) {
    // Prefer hex when the value looks like hex (including the old 64-char format).
    ikm = Buffer.from(raw, "hex");
  } else {
    // Any other string (passphrase, base64, UUID, etc.) is used as UTF-8 IKM.
    ikm = Buffer.from(raw, "utf8");
  }

  if (ikm.length < 1) {
    throw new Error("AETHER_API_KEY_ENCRYPTION_KEY is empty after decoding");
  }

  return Buffer.from(
    hkdfSync("sha256", ikm, Buffer.alloc(0), Buffer.from("aether-provider-credentials-v1"), 32),
  );
}

function legacyEncryptionKey(): Buffer | null {
  const raw =
    process.env.AETHER_PROVIDER_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    process.env.AETHER_API_KEY_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const decoded = Buffer.from(raw, "base64url");
  return decoded.length === 32 ? decoded : null;
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `2.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptSecret(value: string): string {
  const [version, ivText, tagText, ciphertextText] = value.split(".");
  if (!ivText || !tagText || !ciphertextText || (version !== "1" && version !== "2")) {
    throw new Error("Invalid encrypted provider credential");
  }

  const ciphertext = Buffer.from(ciphertextText, "base64url");
  const iv = Buffer.from(ivText, "base64url");
  const tag = Buffer.from(tagText, "base64url");

  const decryptWith = (key: Buffer) => {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  };

  try {
    return decryptWith(encryptionKey());
  } catch (derivedError) {
    if (version !== "1") throw derivedError;
    const legacy = legacyEncryptionKey();
    if (!legacy) throw derivedError;
    return decryptWith(legacy);
  }
}

export async function getActiveProviderCredential(admin: SupabaseClient, provider: string, purpose: ProviderCredentialPurpose) {
  const { data, error } = await admin.from("aether_provider_credentials").select("id,provider,purpose,label,base_url,encrypted_api_key,metadata").eq("provider", provider).eq("purpose", purpose).eq("active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Provider credential lookup failed: ${error.message}`);
  if (!data) return null;
  return { id: data.id, provider: data.provider, purpose: data.purpose, label: data.label, baseUrl: data.base_url, apiKey: decryptSecret(data.encrypted_api_key), metadata: data.metadata ?? {} };
}

export async function saveProviderCredential(admin: SupabaseClient, input: { provider: string; purpose: ProviderCredentialPurpose; label: string; apiKey: string; baseUrl?: string | null; metadata?: Record<string, unknown>; actorId: string }) {
  const provider = input.provider.trim().toLowerCase();
  const label = input.label.trim();
  const apiKey = input.apiKey.trim();
  if (!provider) throw new Response("Provider is required", { status: 400 });
  if (!label) throw new Response("Credential label is required", { status: 400 });
  if (!apiKey) throw new Response("API key is required", { status: 400 });
  const now = new Date().toISOString();
  await admin.from("aether_provider_credentials").update({ active: false, updated_by: input.actorId, updated_at: now }).eq("provider", provider).eq("purpose", input.purpose).eq("active", true);
  const { data, error } = await admin.from("aether_provider_credentials").insert({ provider, purpose: input.purpose, label, base_url: input.baseUrl?.trim() || null, encrypted_api_key: encryptSecret(apiKey), active: true, metadata: input.metadata ?? {}, created_by: input.actorId, updated_by: input.actorId }).select("id,provider,purpose,label,base_url,active,created_at,updated_at").single();
  if (error || !data) throw new Response(`Could not save provider credential: ${error?.message ?? "unknown error"}`, { status: 500 });
  await admin.from("audit_logs").insert({ actor_id: input.actorId, action: "provider.credential.saved", target_type: "aether_provider_credentials", target_id: data.id, metadata: { provider, purpose: input.purpose, label } });
  return data;
}

export async function listProviderCredentials(admin: SupabaseClient) {
  const { data, error } = await admin.from("aether_provider_credentials").select("id,provider,purpose,label,base_url,active,created_at,updated_at,metadata").order("provider").order("purpose").order("updated_at", { ascending: false });
  if (error) throw new Response(`Could not load provider credentials: ${error.message}`, { status: 500 });
  return data ?? [];
}

export async function setProviderCredentialActive(admin: SupabaseClient, id: string, active: boolean, actorId: string) {
  const { data: current, error: currentError } = await admin.from("aether_provider_credentials").select("id,provider,purpose").eq("id", id).maybeSingle();
  if (currentError || !current) throw new Response("Provider credential not found", { status: 404 });
  if (active) await admin.from("aether_provider_credentials").update({ active: false, updated_by: actorId, updated_at: new Date().toISOString() }).eq("provider", current.provider).eq("purpose", current.purpose).eq("active", true).neq("id", id);
  const { error } = await admin.from("aether_provider_credentials").update({ active, updated_by: actorId, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Response(`Could not update provider credential: ${error.message}`, { status: 500 });
  await admin.from("audit_logs").insert({ actor_id: actorId, action: active ? "provider.credential.activated" : "provider.credential.disabled", target_type: "aether_provider_credentials", target_id: id, metadata: {} });
  return { ok: true };
}
