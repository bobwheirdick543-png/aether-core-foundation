begin;

create table if not exists public.aether_knowledge_acquisition_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.aether_knowledge_acquisition_jobs(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sender_type text not null check (sender_type in ('user','agent','system')),
  sender_id uuid references auth.users(id) on delete set null,
  content text not null check (char_length(content) between 1 and 12000),
  action_type text not null default 'message' check (action_type in ('message','extend_time','continue_aspect','refine_research')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists aether_knowledge_acquisition_messages_job_idx
  on public.aether_knowledge_acquisition_messages(job_id, created_at asc);

alter table public.aether_knowledge_acquisition_messages enable row level security;
drop policy if exists "acquisition messages owner read" on public.aether_knowledge_acquisition_messages;
drop policy if exists "acquisition messages admin read" on public.aether_knowledge_acquisition_messages;
drop policy if exists "acquisition messages owner insert" on public.aether_knowledge_acquisition_messages;
create policy "acquisition messages owner read" on public.aether_knowledge_acquisition_messages
  for select to authenticated using (owner_id = auth.uid());
create policy "acquisition messages admin read" on public.aether_knowledge_acquisition_messages
  for select to authenticated using (public.has_role(auth.uid(),'admin'::public.app_role));
create policy "acquisition messages owner insert" on public.aether_knowledge_acquisition_messages
  for insert to authenticated with check (owner_id = auth.uid() and sender_type = 'user' and sender_id = auth.uid());
revoke all on public.aether_knowledge_acquisition_messages from anon, public;
grant select, insert on public.aether_knowledge_acquisition_messages to authenticated;

create table if not exists public.aether_knowledge_acquisition_extensions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.aether_knowledge_acquisition_jobs(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  run_id uuid references public.task_runs(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  minutes integer not null check (minutes between 1 and 60),
  previous_deadline timestamptz,
  new_deadline timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists aether_knowledge_acquisition_extensions_job_idx
  on public.aether_knowledge_acquisition_extensions(job_id, created_at desc);

alter table public.aether_knowledge_acquisition_extensions enable row level security;
drop policy if exists "acquisition extensions owner read" on public.aether_knowledge_acquisition_extensions;
drop policy if exists "acquisition extensions admin read" on public.aether_knowledge_acquisition_extensions;
create policy "acquisition extensions owner read" on public.aether_knowledge_acquisition_extensions
  for select to authenticated using (owner_id = auth.uid());
create policy "acquisition extensions admin read" on public.aether_knowledge_acquisition_extensions
  for select to authenticated using (public.has_role(auth.uid(),'admin'::public.app_role));
revoke all on public.aether_knowledge_acquisition_extensions from anon, public;
grant select on public.aether_knowledge_acquisition_extensions to authenticated;

commit;