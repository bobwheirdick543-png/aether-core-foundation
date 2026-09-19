// Server-side Supabase client with service role key - bypasses RLS.
// Use this for trusted server-only operations. Client-facing authenticated queries keep the generated Database type.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function getSupabaseServerEnv(): { url: string; serviceRoleKey: string } | null {
  const SUPABASE_URL = process.env['SUPABASE_URL'];
  const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return { url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY };
}

export function isSupabaseServerConfigured(): boolean {
  return getSupabaseServerEnv() !== null;
}

function createSupabaseAdminClient(): SupabaseClient {
  const env = getSupabaseServerEnv();
  if (!env) {
    const missing = [
      ...(!process.env['SUPABASE_URL'] ? ['SUPABASE_URL'] : []),
      ...(!process.env['SUPABASE_SERVICE_ROLE_KEY'] ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    throw new Error(
      `Missing Supabase environment variable(s): ${missing.join(', ')}. Set them in Vercel (Project Settings → Environment Variables) and redeploy.`,
    );
  }
  return createClient(env.url, env.serviceRoleKey, {
    global: { fetch: createSupabaseFetch(env.serviceRoleKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

let _supabaseAdmin: SupabaseClient | undefined;

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
