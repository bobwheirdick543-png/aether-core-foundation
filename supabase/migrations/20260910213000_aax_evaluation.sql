create table if not exists public.aax_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.aax_models(id) on delete cascade,
  results jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists aax_evaluations_model_created_idx on public.aax_evaluations(model_id, created_at desc);
alter table public.aax_evaluations enable row level security;
create policy "admins can read aax evaluations" on public.aax_evaluations for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins can create aax evaluations" on public.aax_evaluations for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
