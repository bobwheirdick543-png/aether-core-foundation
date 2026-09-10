create table if not exists public.aax_model_health (
  model_id uuid primary key references public.aax_models(id) on delete cascade,
  state text not null default 'healthy' check (state in ('healthy','degraded','unavailable','cooldown','disabled')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  consecutive_successes integer not null default 0 check (consecutive_successes >= 0),
  total_requests bigint not null default 0 check (total_requests >= 0),
  total_failures bigint not null default 0 check (total_failures >= 0),
  total_fallbacks bigint not null default 0 check (total_fallbacks >= 0),
  cooldown_until timestamptz,
  last_error text,
  last_error_at timestamptz,
  last_success_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.aax_model_health enable row level security;
drop policy if exists aax_model_health_admin_read on public.aax_model_health;
create policy aax_model_health_admin_read on public.aax_model_health for select to authenticated using (public.has_role(auth.uid(),'admin'));
revoke all on public.aax_model_health from public;
grant select on public.aax_model_health to authenticated;
grant all on public.aax_model_health to service_role;
insert into public.aax_model_health(model_id) select id from public.aax_models on conflict (model_id) do nothing;
create index if not exists aax_model_health_state_idx on public.aax_model_health(state, updated_at desc);
