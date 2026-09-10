create table if not exists public.aax_evaluations (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.aax_models(id) on delete cascade,
  suite_key text not null default 'manual', status text not null default 'completed' check (status in ('queued','running','completed','failed','cancelled')),
  cases jsonb not null default '[]'::jsonb, results jsonb not null default '[]'::jsonb, summary jsonb not null default '{}'::jsonb, metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
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

create table if not exists public.aax_model_health (
  model_id uuid primary key references public.aax_models(id) on delete cascade,
  state text not null default 'healthy' check (state in ('healthy','degraded','unavailable','cooldown','disabled')),
  consecutive_failures integer not null default 0, consecutive_successes integer not null default 0,
  total_requests bigint not null default 0, total_failures bigint not null default 0, total_fallbacks bigint not null default 0,
  cooldown_until timestamptz, last_error text, last_error_at timestamptz, last_success_at timestamptz, updated_at timestamptz not null default now()
);
create index if not exists aax_model_health_state_idx on public.aax_model_health(state,cooldown_until);
alter table public.aax_model_health enable row level security;
drop policy if exists aax_model_health_admin_read on public.aax_model_health;
create policy aax_model_health_admin_read on public.aax_model_health for select to authenticated using (public.has_role(auth.uid(),'admin'));

alter table public.aax_models add column if not exists parent_model_id uuid references public.aax_models(id);
alter table public.aax_models add column if not exists improvements jsonb not null default '[]'::jsonb;
alter table public.aax_models add column if not exists specialization_profile jsonb not null default '{}'::jsonb;
create index if not exists aax_models_parent_idx on public.aax_models(parent_model_id);
alter table public.aax_knowledge_items add column if not exists specialization text;
alter table public.aax_knowledge_items add column if not exists integrated_aax_version integer;
create index if not exists aax_knowledge_items_specialization_idx on public.aax_knowledge_items(model_id,specialization);
alter table public.aax_knowledge_changes add column if not exists target_aax_version integer;
create index if not exists aax_knowledge_changes_target_version_idx on public.aax_knowledge_changes(target_model_id,target_aax_version);
alter table public.aax_training_jobs add column if not exists requested_by uuid references auth.users(id);
alter table public.aax_training_jobs add column if not exists approved_by uuid references auth.users(id);
alter table public.aax_training_jobs add column if not exists approved_at timestamptz;
