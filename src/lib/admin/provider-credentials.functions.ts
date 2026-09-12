import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listProviderCredentials, saveProviderCredential, setProviderCredentialActive, type ProviderCredentialPurpose } from "./provider-credentials";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Response("Unable to verify administrator authorization", { status: 500 });
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const listAdminProviderCredentials = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => { await assertAdmin(context.userId); return listProviderCredentials(supabaseAdmin); });
export const saveAdminProviderCredential = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { provider: string; purpose: ProviderCredentialPurpose; label: string; apiKey: string; baseUrl?: string | null }) => data).handler(async ({ context, data }) => { await assertAdmin(context.userId); return saveProviderCredential(supabaseAdmin, { ...data, actorId: context.userId }); });
export const setAdminProviderCredentialActive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data: { id: string; active: boolean }) => data).handler(async ({ context, data }) => { await assertAdmin(context.userId); return setProviderCredentialActive(supabaseAdmin, data.id, data.active, context.userId); });
