create extension if not exists pgcrypto;

create table if not exists public.aax_models (
  id uuid primary key default gen_random_uuid(), model_key text not null unique, display_name text not null,
  generation integer not null default 1, revision integer not null default 0, description text not null default '',
  provider text, provider_model text, capabilities text[] not null default '{}', specializations text[] not null default '{}',
  context_window integer not null default 128000, output_limit integer,
  release_status text not null default 'draft' check (release_status in ('draft','training','evaluation','approved','scheduled','announced','available','deprecated','retired')),
  scheduled_release_at timestamptz, available_at timestamptz, disabled_at timestamptz,
  config jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.aax_knowledge_items (
  id uuid primary key default gen_random_uuid(), model_id uuid not null references public.aax_models(id) on delete cascade,
  source_id uuid, source_hash text, source_type text not null, source_locator jsonb not null default '{}',
  content jsonb not null default '{}', knowledge_state text not null default 'candidate' check (knowledge_state in ('candidate','verified','integrated','corrected','contradicted','rejected','retired')),
  provenance jsonb not null default '{}', confidence numeric, integrated_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.aax_training_jobs (
  id uuid primary key default gen_random_uuid(), target_model_id uuid not null references public.aax_models(id) on delete cascade,
  source_type text not null, source_id uuid, source_hash text, original_source_ref jsonb not null default '{}',
  pipeline_status text not null default 'queued' check (pipeline_status in ('queued','running','waiting_approval','completed','failed','cancelled')),
  timeout_ms bigint not null default 3600000, started_at timestamptz, completed_at timestamptz, report_id uuid,
  collective_package jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.aax_understanding_artifacts (
  id uuid primary key default gen_random_uuid(), training_job_id uuid references public.aax_training_jobs(id) on delete cascade,
  agent_key text not null, target_model_id uuid not null references public.aax_models(id) on delete cascade, source_id uuid,
  parent_understanding_ids uuid[] not null default '{}', sequence_no integer not null default 0,
  artifact jsonb not null default '{}', confidence numeric, created_at timestamptz not null default now()
);

create table if not exists public.ai_stat_register (
  id uuid primary key default gen_random_uuid(), entity_type text not null check (entity_type in ('agent','aax_model')),
  entity_id uuid not null, metric_key text not null, previous_value numeric not null default 0, delta numeric not null,
  new_value numeric not null, evidence jsonb not null default '{}', reason text not null, task_id uuid, run_id uuid,
  knowledge_event_id uuid, evaluation_id uuid, created_at timestamptz not null default now()
);

create table if not exists public.ai_stat_current (
  entity_type text not null check (entity_type in ('agent','aax_model')), entity_id uuid not null, metric_key text not null,
  value numeric not null default 0, updated_at timestamptz not null default now(), primary key (entity_type, entity_id, metric_key)
);

create table if not exists public.ai_stat_snapshots (
  id uuid primary key default gen_random_uuid(), entity_type text not null check (entity_type in ('agent','aax_model')),
  entity_id uuid not null, snapshot_date date not null, metrics jsonb not null default '{}', created_at timestamptz not null default now(),
  unique (entity_type, entity_id, snapshot_date)
);

create index if not exists idx_aax_knowledge_model_state on public.aax_knowledge_items(model_id, knowledge_state);
create index if not exists idx_aax_understanding_target_seq on public.aax_understanding_artifacts(target_model_id, sequence_no);
create index if not exists idx_aax_training_target_status on public.aax_training_jobs(target_model_id, pipeline_status);
create index if not exists idx_ai_stat_register_entity_metric on public.ai_stat_register(entity_type, entity_id, metric_key, created_at desc);

alter table public.aax_models enable row level security;
alter table public.aax_knowledge_items enable row level security;
alter table public.aax_training_jobs enable row level security;
alter table public.aax_understanding_artifacts enable row level security;
alter table public.ai_stat_register enable row level security;
alter table public.ai_stat_current enable row level security;
alter table public.ai_stat_snapshots enable row level security;

create policy aax_models_admin_all on public.aax_models for all to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy aax_models_public_read_available on public.aax_models for select to authenticated using (release_status in ('announced','available','deprecated'));
create policy aax_knowledge_admin_all on public.aax_knowledge_items for all to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy aax_training_admin_all on public.aax_training_jobs for all to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy aax_understanding_admin_all on public.aax_understanding_artifacts for all to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy ai_stat_register_admin_all on public.ai_stat_register for all to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy ai_stat_current_admin_all on public.ai_stat_current for all to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy ai_stat_snapshots_admin_all on public.ai_stat_snapshots for all to authenticated using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));

insert into public.aax_models (model_key, display_name, generation, revision, description, capabilities, release_status)
values
 ('aax-1.0','Aether Ascension 1.0',1,0,'Aether Ascension first generation.','{reasoning,conversation,knowledge,tools}','draft'),
 ('aax-2.0','Aether Ascension 2.0',2,0,'Aether Ascension second generation.','{reasoning,conversation,knowledge,tools,structured-output}','draft'),
 ('aax-3.1','Aether Ascension 3.1',3,1,'Aether Ascension third generation revision one.','{reasoning,conversation,knowledge,tools,structured-output,vision,multimodal}','draft'),
 ('aax-4.0','Aether Ascension 4.0',4,0,'Aether Ascension fourth generation.','{reasoning,conversation,knowledge,tools,structured-output,vision,multimodal,long-context}','draft'),
 ('aax-5.1','Aether Ascension 5.1',5,1,'Aether Ascension fifth generation revision one.','{reasoning,conversation,knowledge,tools,structured-output,vision,multimodal,long-context,advanced-reasoning}','draft')
on conflict (model_key) do nothing;

insert into public.ai_stat_current(entity_type, entity_id, metric_key, value)
select 'aax_model', id, metric, 0 from public.aax_models cross join unnest(array['intelligence','speed','response_time','accuracy','reasoning_quality','knowledge_depth','problem_solving','adaptability','learning_rate','reliability','tool_proficiency','context_retention','instruction_following','research_quality','verification_strength','knowledge_connectivity','communication_quality','overall']) metric on conflict do nothing;
insert into public.ai_stat_current(entity_type, entity_id, metric_key, value)
select 'agent', id, metric, 0 from public.agents cross join unnest(array['intelligence','speed','response_time','accuracy','reasoning_quality','knowledge_depth','problem_solving','adaptability','learning_rate','reliability','tool_proficiency','context_retention','instruction_following','research_quality','verification_strength','knowledge_connectivity','communication_quality','overall']) metric on conflict do nothing;
