-- Number 19: durable telemetry for the single centralized web-search capability.
create table if not exists public.aether_web_search_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  agent_key text not null,
  actor_id uuid,
  task_id uuid,
  run_id uuid,
  provider text not null default 'exa',
  query_fingerprint text not null,
  search_type text not null,
  result_count integer not null default 0,
  latency_ms integer,
  cost_dollars numeric,
  status text not null check (status in ('completed','failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists aether_web_search_requests_agent_created_idx
  on public.aether_web_search_requests(agent_key, created_at desc);
create index if not exists aether_web_search_requests_actor_created_idx
  on public.aether_web_search_requests(actor_id, created_at desc);
create index if not exists aether_web_search_requests_task_idx
  on public.aether_web_search_requests(task_id);

alter table public.aether_web_search_requests enable row level security;

drop policy if exists "Users can read own web search telemetry" on public.aether_web_search_requests;
create policy "Users can read own web search telemetry"
on public.aether_web_search_requests for select to authenticated
using (
  actor_id = auth.uid()
  or coalesce((select has_role(auth.uid(), 'admin')), false)
);

drop policy if exists "Service role writes web search telemetry" on public.aether_web_search_requests;
create policy "Service role writes web search telemetry"
on public.aether_web_search_requests for insert to service_role
with check (true);

comment on table public.aether_web_search_requests is
  'Durable telemetry for Aether live-web searches. Stores no provider credential or raw query text.';
