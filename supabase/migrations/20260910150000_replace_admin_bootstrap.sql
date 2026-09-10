-- Administrator identity is now controlled by the server-side AETHER_ADMIN_EMAIL
-- environment variable and Supabase Auth email confirmation. The legacy setup-code
-- tables are no longer part of the authorization flow.
DROP TABLE IF EXISTS public.admin_bootstrap_attempts;
DROP TABLE IF EXISTS public.admin_bootstrap;

-- Keep model configuration globally readable while retaining administrator-only writes.
-- The existing model_configs RLS policies already enforce this; these indexes simply
-- keep the admin overview/model surface deterministic and fast.
CREATE INDEX IF NOT EXISTS model_configs_sort_order_idx
  ON public.model_configs (sort_order, role_key);

CREATE INDEX IF NOT EXISTS agents_agent_key_idx
  ON public.agents (agent_key);
