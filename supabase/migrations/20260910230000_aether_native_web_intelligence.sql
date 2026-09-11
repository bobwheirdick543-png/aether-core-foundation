create table if not exists public.aether_research_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('user','admin','agent','api')),
  query text not null,
  status text not null default 'running' check (status in ('running','completed','failed','cancelled')),
  source_count integer not null default 0 check (source_count >= 0),
  diversity_score numeric(5,4) check (diversity_score is null or (diversity_score >= 0 and diversity_score <= 1)),
  task_id uuid references public.tasks(id) on delete set null,
  run_id uuid references public.task_runs(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.aether_research_sources (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.aether_research_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  canonical_url text,
  title text,
  domain text not null,
  provider text not null,
  snippet text,
  content text,
  status text not null default 'retrieved' check (status in ('discovered','retrieved','failed','blocked','outdated')),
  http_status integer,
  content_hash text,
  published_at timestamptz,
  updated_at_source timestamptz,
  retrieved_at timestamptz not null default now(),
  quality_metadata jsonb not null default '{}'::jsonb,
  unique(session_id, canonical_url)
);

create index if not exists aether_research_sessions_owner_idx on public.aether_research_sessions(owner_id, started_at desc);
create index if not exists aether_research_sessions_task_idx on public.aether_research_sessions(task_id);
create index if not exists aether_research_sources_session_idx on public.aether_research_sources(session_id, retrieved_at desc);
create index if not exists aether_research_sources_owner_idx on public.aether_research_sources(owner_id, retrieved_at desc);
create index if not exists aether_research_sources_domain_idx on public.aether_research_sources(domain);
create index if not exists aether_research_sources_hash_idx on public.aether_research_sources(content_hash);

alter table public.aether_research_sessions enable row level security;
alter table public.aether_research_sources enable row level security;

create policy "aether research sessions owner read" on public.aether_research_sessions for select to authenticated using (owner_id = auth.uid());
create policy "aether research sessions owner insert" on public.aether_research_sessions for insert to authenticated with check (owner_id = auth.uid());
create policy "aether research sessions owner update" on public.aether_research_sessions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "aether research sources owner read" on public.aether_research_sources for select to authenticated using (owner_id = auth.uid());
create policy "aether research sources owner insert" on public.aether_research_sources for insert to authenticated with check (owner_id = auth.uid());
