create table if not exists public.aax_model_health (
  model_id uuid primary key references public.aax_models(id) on delete cascade,
  state text not null default 'healthy' check (state in ('healthy','degraded','unavailable','cooldown','disabled')),
  consecutive_failures integer not null default 0,
  consecutive_successes integer not null default 0,
  total_requests bigint not null default 0,
  total_failures bigint not null default 0,
  total_fallbacks bigint not null default 0,
  cooldown_until timestamptz,
  last_error text,
  last_error_at timestamptz,
  last_success_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.aax_model_health add column if not exists consecutive_failures integer not null default 0;
alter table public.aax_model_health add column if not exists consecutive_successes integer not null default 0;
alter table public.aax_model_health add column if not exists total_requests bigint not null default 0;
alter table public.aax_model_health add column if not exists total_failures bigint not null default 0;
alter table public.aax_model_health add column if not exists total_fallbacks bigint not null default 0;
alter table public.aax_model_health add column if not exists cooldown_until timestamptz;
alter table public.aax_model_health add column if not exists last_error text;
alter table public.aax_model_health add column if not exists last_error_at timestamptz;
alter table public.aax_model_health add column if not exists last_success_at timestamptz;
create index if not exists aax_model_health_state_idx on public.aax_model_health(state,cooldown_until);
alter table public.aax_model_health enable row level security;
drop policy if exists "aax health admin read" on public.aax_model_health;
drop policy if exists "aax health service write" on public.aax_model_health;
drop policy if exists aax_model_health_admin_read on public.aax_model_health;
create policy aax_model_health_admin_read on public.aax_model_health for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy aax_health_service_write on public.aax_model_health for all to service_role using (true) with check (true);
