create table if not exists public.aether_api_idempotency (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.aether_api_keys(id) on delete cascade,
  owner_id uuid not null,
  idempotency_key text not null,
  request_hash text not null,
  status_code integer not null default 202,
  response_body jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique(api_key_id, idempotency_key)
);
create index if not exists aether_api_idempotency_expires_idx on public.aether_api_idempotency(expires_at);
alter table public.aether_api_logs add column if not exists idempotency_key text;
alter table public.aether_api_logs add column if not exists api_version text default 'v1';
alter table public.aether_api_logs add column if not exists scope text;
create index if not exists aether_api_logs_owner_created_idx on public.aether_api_logs(owner_id, created_at desc);
create index if not exists aether_api_logs_key_created_idx on public.aether_api_logs(api_key_id, created_at desc);
create index if not exists aether_api_key_events_owner_created_idx on public.aether_api_key_events(owner_id, created_at desc);
alter table public.aether_api_idempotency enable row level security;
revoke all on public.aether_api_idempotency from anon, authenticated;
