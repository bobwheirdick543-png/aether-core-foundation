create table if not exists public.aax_model_health (
  model_id uuid primary key references public.aax_models(id) on delete cascade,
  state text not null check (state in ('healthy','degraded','unavailable','cooldown','disabled')),
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aax_model_health enable row level security;

create policy "aax health admin read" on public.aax_model_health
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "aax health service write" on public.aax_model_health
  for all to service_role
  using (true) with check (true);
