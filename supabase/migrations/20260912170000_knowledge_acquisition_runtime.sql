begin;

create table if not exists public.aether_knowledge_acquisition_jobs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  run_id uuid references public.task_runs(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  subject text not null,
  scope jsonb not null default '{}'::jsonb,
  depth_tier text not null default 'A' check (depth_tier in ('A','B','C','D','E')),
  time_budget_ms bigint not null default 900000 check (time_budget_ms between 300000 and 3600000),
  target_type text not null default 'global' check (target_type in ('agent','model','models','global')),
  target_model_keys text[] not null default '{}'::text[],
  source_type text not null default 'background' check (source_type in ('background','user','admin','url','github','document','prompt','image')),
  dedupe_key text not null,
  status text not null default 'queued' check (status in ('queued','running','paused','waiting_approval','completed','failed','cancelled')),
  coverage numeric(5,4) not null default 0 check (coverage between 0 and 1),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1),
  source_count integer not null default 0,
  domain_count integer not null default 0,
  related_concepts jsonb not null default '[]'::jsonb,
  unresolved_items jsonb not null default '[]'::jsonb,
  report_ids uuid[] not null default '{}'::uuid[],
  candidate_id uuid references public.aether_knowledge_candidates(id) on delete set null,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','revision_requested')),
  cancel_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  paused_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists aether_knowledge_acquisition_jobs_dedupe_idx
  on public.aether_knowledge_acquisition_jobs(dedupe_key)
  where status in ('queued','running','paused','waiting_approval');
create index if not exists aether_knowledge_acquisition_jobs_status_idx
  on public.aether_knowledge_acquisition_jobs(status, created_at);
create index if not exists aether_knowledge_acquisition_jobs_owner_idx
  on public.aether_knowledge_acquisition_jobs(owner_id, created_at desc);

alter table public.aether_knowledge_acquisition_jobs enable row level security;
drop policy if exists "knowledge acquisition owner read" on public.aether_knowledge_acquisition_jobs;
drop policy if exists "knowledge acquisition admin read" on public.aether_knowledge_acquisition_jobs;
create policy "knowledge acquisition owner read" on public.aether_knowledge_acquisition_jobs
  for select to authenticated using (owner_id = auth.uid());
create policy "knowledge acquisition admin read" on public.aether_knowledge_acquisition_jobs
  for select to authenticated using (public.has_role(auth.uid(),'admin'::public.app_role));
revoke all on public.aether_knowledge_acquisition_jobs from anon, public;
grant select on public.aether_knowledge_acquisition_jobs to authenticated;

-- runtime_quotas historically permits more than one NULL-scoped platform row.
-- Collapse that legacy shape before applying the bounded acquisition limits.
delete from public.runtime_quotas
where scope_type = 'platform' and scope_id is null
  and id not in (
    select id from public.runtime_quotas
    where scope_type = 'platform' and scope_id is null
    order by created_at asc, id asc limit 1
  );
insert into public.runtime_quotas(scope_type,scope_id,max_concurrent,max_queue_depth,max_runtime_ms,max_retries)
select 'platform',null,10,5000,18000000,3
where not exists (select 1 from public.runtime_quotas where scope_type='platform' and scope_id is null);
update public.runtime_quotas
set max_concurrent = 10,
    max_queue_depth = greatest(max_queue_depth, 5000),
    max_runtime_ms = greatest(max_runtime_ms, 3600000),
    max_retries = 3,
    updated_at = now()
where scope_type = 'platform' and scope_id is null;

commit;