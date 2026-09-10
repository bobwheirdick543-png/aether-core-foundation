create table if not exists public.aax_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.aax_models(id) on delete cascade,
  suite_key text not null default 'manual',
  status text not null default 'completed' check (status in ('queued','running','completed','failed','cancelled')),
  cases jsonb not null default '[]'::jsonb,
  results jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.aax_evaluations add column if not exists suite_key text not null default 'manual';
alter table public.aax_evaluations add column if not exists status text not null default 'completed';
alter table public.aax_evaluations add column if not exists cases jsonb not null default '[]'::jsonb;
alter table public.aax_evaluations add column if not exists started_at timestamptz;
alter table public.aax_evaluations add column if not exists completed_at timestamptz;
alter table public.aax_evaluations add column if not exists updated_at timestamptz not null default now();
create index if not exists aax_evaluations_model_created_idx on public.aax_evaluations(model_id, created_at desc);
create index if not exists aax_evaluations_model_status_idx on public.aax_evaluations(model_id,status,created_at desc);
alter table public.aax_evaluations enable row level security;
drop policy if exists "admins can read aax evaluations" on public.aax_evaluations;
drop policy if exists "admins can create aax evaluations" on public.aax_evaluations;
drop policy if exists aax_evaluations_admin_all on public.aax_evaluations;
create policy aax_evaluations_admin_all on public.aax_evaluations for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
