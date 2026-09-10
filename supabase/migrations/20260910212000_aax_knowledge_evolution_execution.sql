-- AAX knowledge-evolution execution ledger.
-- Original sources and every agent understanding are append-only evidence.

create table if not exists public.aax_understanding_artifacts (
  id uuid primary key default gen_random_uuid(),
  training_job_id uuid not null references public.aax_training_jobs(id) on delete cascade,
  target_model_id uuid not null references public.aax_models(id) on delete cascade,
  agent_key text not null,
  sequence integer not null,
  source_id uuid,
  parent_understanding_ids uuid[] not null default '{}',
  original_source_ref jsonb not null default '{}'::jsonb,
  accumulated_context jsonb not null default '{}'::jsonb,
  interpretation text not null,
  concepts jsonb not null default '[]'::jsonb,
  definitions jsonb not null default '[]'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  context jsonb not null default '[]'::jsonb,
  new_knowledge jsonb not null default '[]'::jsonb,
  existing_knowledge_links jsonb not null default '[]'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  contradictions jsonb not null default '[]'::jsonb,
  uncertainties jsonb not null default '[]'::jsonb,
  cross_domain_connections jsonb not null default '[]'::jsonb,
  reasoning jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  confidence numeric,
  recommended_knowledge_changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(training_job_id, agent_key, sequence)
);
create index if not exists aax_understanding_job_idx on public.aax_understanding_artifacts(training_job_id, sequence);
create index if not exists aax_understanding_model_idx on public.aax_understanding_artifacts(target_model_id, created_at desc);
alter table public.aax_understanding_artifacts enable row level security;
grant select on public.aax_understanding_artifacts to authenticated;
grant all on public.aax_understanding_artifacts to service_role;
drop policy if exists "aax understanding owner/admin" on public.aax_understanding_artifacts;
create policy "aax understanding owner/admin" on public.aax_understanding_artifacts for select to authenticated
using (public.has_role(auth.uid(), 'admin') or exists (
  select 1 from public.aax_training_jobs j where j.id = aax_understanding_artifacts.training_job_id
  and exists (select 1 from public.tasks t where t.id = j.source_id and t.owner_id = auth.uid())
));

create table if not exists public.aax_knowledge_events (
  id uuid primary key default gen_random_uuid(),
  training_job_id uuid not null references public.aax_training_jobs(id) on delete cascade,
  target_model_id uuid not null references public.aax_models(id) on delete cascade,
  stage text not null,
  event_type text not null,
  agent_key text,
  understanding_id uuid references public.aax_understanding_artifacts(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists aax_knowledge_events_job_idx on public.aax_knowledge_events(training_job_id, created_at);
create index if not exists aax_knowledge_events_model_idx on public.aax_knowledge_events(target_model_id, created_at desc);
alter table public.aax_knowledge_events enable row level security;
grant select on public.aax_knowledge_events to authenticated;
grant all on public.aax_knowledge_events to service_role;
drop policy if exists "aax knowledge events admin" on public.aax_knowledge_events;
create policy "aax knowledge events admin" on public.aax_knowledge_events for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create table if not exists public.aax_knowledge_changes (
  id uuid primary key default gen_random_uuid(),
  training_job_id uuid not null references public.aax_training_jobs(id) on delete cascade,
  target_model_id uuid not null references public.aax_models(id) on delete cascade,
  change_type text not null check (change_type in ('new','reinforced','expanded','corrected','contradicted','relationship')),
  statement text not null,
  provenance jsonb not null default '{}'::jsonb,
  verification_status text not null default 'pending',
  confidence numeric,
  integrated boolean not null default false,
  integrated_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists aax_knowledge_changes_model_idx on public.aax_knowledge_changes(target_model_id, created_at desc);
create index if not exists aax_knowledge_changes_job_idx on public.aax_knowledge_changes(training_job_id, created_at);
alter table public.aax_knowledge_changes enable row level security;
grant select on public.aax_knowledge_changes to authenticated;
grant all on public.aax_knowledge_changes to service_role;
drop policy if exists "aax knowledge changes admin" on public.aax_knowledge_changes;
create policy "aax knowledge changes admin" on public.aax_knowledge_changes for select to authenticated using (public.has_role(auth.uid(), 'admin'));

alter table public.aax_training_jobs add column if not exists original_source_content text;
alter table public.aax_training_jobs add column if not exists source_metadata jsonb not null default '{}'::jsonb;
alter table public.aax_training_jobs add column if not exists pipeline_context jsonb not null default '{}'::jsonb;
alter table public.aax_training_jobs add column if not exists error text;
