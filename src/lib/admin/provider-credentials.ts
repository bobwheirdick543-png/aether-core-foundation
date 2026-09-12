import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderCredentialPurpose = "aax_inference" | "knowledge_research";

function encryptionKey(): Buffer {
  const raw = process.env.AETHER_PROVIDER_CREDENTIAL_ENCRYPTION_KEY?.trim() || process.env.AETHER_API_KEY_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("Missing server configuration: AETHER_API_KEY_ENCRYPTION_KEY");
  const base = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64url");
  if (base.length !== 32) throw new Error("Provider credential encryption key must encode exactly 32 bytes");
  return Buffer.from(hkdfSync("sha256", base, Buffer.alloc(0), Buffer.from("aether-provider-credentials-v1"), 32));
}

function encryptSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptSecret(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted provider credential");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export async function getActiveProviderCredential(admin: SupabaseClient, provider: string, purpose: ProviderCredentialPurpose) {
  const { data, error } = await admin.from("aether_provider_credentials").select("id,provider,purpose,label,base_url,encrypted_api_key,metadata").eq("provider", provider).eq("purpose", purpose).eq("active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Provider credential lookup failed: ${error.message}`);
  if (!data) return null;
  return { id: data.id, provider: data.provider, purpose: data.purpose, label: data.label, baseUrl: data.base_url, apiKey: decryptSecret(data.encrypted_api_key), metadata: data.metadata ?? {} };
}

export async function saveProviderCredential(admin: SupabaseClient, input: { provider: string; purpose: ProviderCredentialPurpose; label: string; apiKey: string; baseUrl?: string | null; metadata?: Record<string, unknown>; actorId: string }) {
  const provider = input.provider.trim().toLowerCase();
  const label = input.label.trim().slice(0, 120);
  const apiKey = input.apiKey.trim();
  if (!provider || !label || !apiKey) throw new Response("Provider, label and API key are required", { status: 400 });
  if (!/^[a-z0-9._-]{1,80}$/.test(provider)) throw new Response("Invalid provider identifier", { status: 400 });
  if (input.baseUrl && !/^https:\/\//i.test(input.baseUrl.trim())) throw new Response("Provider base URL must use HTTPS", { status: 400 });
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
