-- Provider credentials are an administrator-managed server secret store.
-- RLS is enabled and client roles have no table privileges; server functions use service_role.
create table if not exists public.aether_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  purpose text not null,
  label text not null,
  base_url text,
  encrypted_api_key text not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(provider)) between 1 and 80),
  check (purpose in ('aax_inference','knowledge_research'))
);
create index if not exists aether_provider_credentials_lookup_idx on public.aether_provider_credentials(provider,purpose,active,updated_at desc);
alter table public.aether_provider_credentials enable row level security;
revoke all on public.aether_provider_credentials from anon,authenticated;
