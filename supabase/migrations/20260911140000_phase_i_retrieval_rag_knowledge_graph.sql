create extension if not exists vector;

create table if not exists public.aether_knowledge_chunks (
  id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.knowledge_entries(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, project_id uuid references public.projects(id) on delete cascade,
  version integer not null, chunk_index integer not null, content text not null check (char_length(trim(content)) between 1 and 20000),
  content_hash text not null, token_estimate integer not null default 0 check (token_estimate >= 0), metadata jsonb not null default '{}'::jsonb,
  is_current boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(entry_id, version, chunk_index), unique(entry_id, version, content_hash)
);
create table if not exists public.aether_knowledge_embeddings (
  id uuid primary key default gen_random_uuid(), chunk_id uuid not null references public.aether_knowledge_chunks(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, project_id uuid references public.projects(id) on delete cascade,
  provider text not null, model text not null, dimensions integer not null check (dimensions > 0), embedding vector(384) not null,
  content_hash text not null, is_current boolean not null default true, created_at timestamptz not null default now(),
  unique(chunk_id, provider, model, content_hash)
);
create table if not exists public.aether_knowledge_graph_nodes (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, canonical_name text not null, normalized_name text not null,
  entity_type text not null default 'unknown', attributes jsonb not null default '{}'::jsonb,
  source_entry_id uuid references public.knowledge_entries(id) on delete set null, source_candidate_id uuid references public.aether_knowledge_candidates(id) on delete set null,
  source_version_id uuid references public.aether_knowledge_versions(id) on delete set null, provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id, project_id, normalized_name, entity_type)
);
create table if not exists public.aether_knowledge_graph_edges (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, subject_node_id uuid not null references public.aether_knowledge_graph_nodes(id) on delete cascade,
  object_node_id uuid not null references public.aether_knowledge_graph_nodes(id) on delete cascade, predicate text not null,
  confidence numeric not null default 0.5 check (confidence between 0 and 1), source_entry_id uuid references public.knowledge_entries(id) on delete set null,
  source_candidate_id uuid references public.aether_knowledge_candidates(id) on delete set null, source_version_id uuid references public.aether_knowledge_versions(id) on delete set null,
  provenance jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(owner_id, project_id, subject_node_id, predicate, object_node_id, source_entry_id, source_version_id)
);
create table if not exists public.aether_retrieval_runs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, query text not null check (char_length(trim(query)) between 1 and 20000),
  mode text not null default 'hybrid' check (mode in ('lexical','semantic','hybrid','graph')), status text not null default 'completed' check (status in ('queued','running','completed','failed','cancelled')),
  top_k integer not null default 8 check (top_k between 1 and 50), metadata jsonb not null default '{}'::jsonb, error text,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.aether_retrieval_results (
  id uuid primary key default gen_random_uuid(), retrieval_run_id uuid not null references public.aether_retrieval_runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade, project_id uuid references public.projects(id) on delete cascade,
  entry_id uuid not null references public.knowledge_entries(id) on delete cascade, chunk_id uuid references public.aether_knowledge_chunks(id) on delete set null,
  version_id uuid references public.aether_knowledge_versions(id) on delete set null, rank integer not null check (rank > 0),
  lexical_score real not null default 0, semantic_score real not null default 0, metadata_score real not null default 0, graph_score real not null default 0,
  final_score real not null default 0, matched_terms text[] not null default '{}', snippet text not null, provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(retrieval_run_id, rank)
);
create table if not exists public.aether_retrieval_index_jobs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, entry_id uuid not null references public.knowledge_entries(id) on delete cascade,
  target_version integer, reason text not null default 'manual', status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  attempts integer not null default 0 check (attempts >= 0), last_error text, created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz
);
create index if not exists aether_knowledge_chunks_owner_project_idx on public.aether_knowledge_chunks(owner_id, project_id, is_current);
create index if not exists aether_knowledge_chunks_entry_version_idx on public.aether_knowledge_chunks(entry_id, version);
create index if not exists aether_knowledge_chunks_fts_idx on public.aether_knowledge_chunks using gin (to_tsvector('simple', content));
create index if not exists aether_knowledge_embeddings_owner_project_idx on public.aether_knowledge_embeddings(owner_id, project_id, is_current);
create index if not exists aether_knowledge_embeddings_vector_idx on public.aether_knowledge_embeddings using hnsw (embedding vector_cosine_ops);
create index if not exists aether_graph_nodes_owner_project_idx on public.aether_knowledge_graph_nodes(owner_id, project_id, normalized_name);
create index if not exists aether_graph_edges_subject_idx on public.aether_knowledge_graph_edges(subject_node_id);
create index if not exists aether_graph_edges_object_idx on public.aether_knowledge_graph_edges(object_node_id);
create index if not exists aether_retrieval_runs_owner_project_idx on public.aether_retrieval_runs(owner_id, project_id, created_at desc);
create index if not exists aether_retrieval_results_run_idx on public.aether_retrieval_results(retrieval_run_id, rank);
create index if not exists aether_retrieval_jobs_owner_status_idx on public.aether_retrieval_index_jobs(owner_id, status, created_at);

alter table public.aether_knowledge_chunks enable row level security;
alter table public.aether_knowledge_embeddings enable row level security;
alter table public.aether_knowledge_graph_nodes enable row level security;
alter table public.aether_knowledge_graph_edges enable row level security;
alter table public.aether_retrieval_runs enable row level security;
alter table public.aether_retrieval_results enable row level security;
alter table public.aether_retrieval_index_jobs enable row level security;

drop policy if exists aether_knowledge_chunks_select on public.aether_knowledge_chunks;
create policy aether_knowledge_chunks_select on public.aether_knowledge_chunks for select using (owner_id = auth.uid());
drop policy if exists aether_knowledge_embeddings_select on public.aether_knowledge_embeddings;
create policy aether_knowledge_embeddings_select on public.aether_knowledge_embeddings for select using (owner_id = auth.uid());
drop policy if exists aether_knowledge_graph_nodes_select on public.aether_knowledge_graph_nodes;
create policy aether_knowledge_graph_nodes_select on public.aether_knowledge_graph_nodes for select using (owner_id = auth.uid());
drop policy if exists aether_knowledge_graph_edges_select on public.aether_knowledge_graph_edges;
create policy aether_knowledge_graph_edges_select on public.aether_knowledge_graph_edges for select using (owner_id = auth.uid());
drop policy if exists aether_retrieval_runs_select on public.aether_retrieval_runs;
create policy aether_retrieval_runs_select on public.aether_retrieval_runs for select using (owner_id = auth.uid());
drop policy if exists aether_retrieval_results_select on public.aether_retrieval_results;
create policy aether_retrieval_results_select on public.aether_retrieval_results for select using (owner_id = auth.uid());
drop policy if exists aether_retrieval_index_jobs_select on public.aether_retrieval_index_jobs;
create policy aether_retrieval_index_jobs_select on public.aether_retrieval_index_jobs for select using (owner_id = auth.uid());

comment on table public.aether_knowledge_chunks is 'Phase I indexed chunks from approved production knowledge only.';
comment on table public.aether_knowledge_embeddings is 'Phase I replaceable embedding adapter output; vector dimension is fixed at 384 for the platform adapter contract.';
comment on table public.aether_knowledge_graph_nodes is 'Phase I permission-scoped knowledge graph nodes.';
comment on table public.aether_knowledge_graph_edges is 'Phase I permission-scoped knowledge graph relationships.';
comment on table public.aether_retrieval_runs is 'Phase I durable retrieval audit/run records.';
comment on table public.aether_retrieval_results is 'Phase I source/version-aware retrieval results; only authorized results are persisted.';
comment on table public.aether_retrieval_index_jobs is 'Phase I durable stale-index rebuild queue.';
