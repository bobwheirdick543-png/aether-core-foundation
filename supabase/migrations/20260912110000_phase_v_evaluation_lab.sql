create table if not exists public.evaluation_test_cases (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160), description text,
  target text not null check (target in ('agents','orchestrator','research','verification','knowledge','reports','notifications','modules','battle-versia')),
  input jsonb not null default '{}'::jsonb, expected_outcome jsonb not null default '{}'::jsonb, tags text[] not null default '{}', active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.evaluation_runs (
  id uuid primary key default gen_random_uuid(), test_case_id uuid not null references public.evaluation_test_cases(id) on delete restrict, owner_id uuid not null references auth.users(id) on delete cascade,
  target text not null, version text not null, environment text not null, evaluator text not null,
  status text not null check (status in ('queued','running','completed','failed','cancelled')) default 'queued', expected_outcome jsonb not null default '{}'::jsonb, actual_output jsonb not null default '{}'::jsonb,
  score numeric(8,5) not null default 0 check (score >= 0 and score <= 1), passed boolean not null default false, latency_ms integer check (latency_ms is null or latency_ms >= 0),
  failure_rate numeric(8,5) not null default 0, retry_rate numeric(8,5) not null default 0, approval_rate numeric(8,5) not null default 0, resource_usage jsonb not null default '{}'::jsonb,
  trace jsonb not null default '[]'::jsonb, errors jsonb not null default '[]'::jsonb, warnings jsonb not null default '[]'::jsonb, related_task_id uuid,
  started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.evaluation_run_events (
  id bigint generated always as identity primary key, run_id uuid not null references public.evaluation_runs(id) on delete cascade, event_type text not null, stage text,
  payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists evaluation_test_cases_owner_target_idx on public.evaluation_test_cases(owner_id, target, active);
create index if not exists evaluation_runs_created_idx on public.evaluation_runs(created_at desc);
create index if not exists evaluation_runs_target_idx on public.evaluation_runs(target, status, created_at desc);
create index if not exists evaluation_runs_case_idx on public.evaluation_runs(test_case_id, created_at desc);
create index if not exists evaluation_run_events_run_idx on public.evaluation_run_events(run_id, created_at);
alter table public.evaluation_test_cases enable row level security; alter table public.evaluation_runs enable row level security; alter table public.evaluation_run_events enable row level security;
create policy "evaluation cases owner read" on public.evaluation_test_cases for select using (owner_id = auth.uid());
create policy "evaluation cases owner write" on public.evaluation_test_cases for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "evaluation runs owner read" on public.evaluation_runs for select using (owner_id = auth.uid());
create policy "evaluation events owner read" on public.evaluation_run_events for select using (exists (select 1 from public.evaluation_runs r where r.id = run_id and r.owner_id = auth.uid()));
revoke all on public.evaluation_test_cases from anon, authenticated; revoke all on public.evaluation_runs from anon, authenticated; revoke all on public.evaluation_run_events from anon, authenticated;
grant select, insert, update, delete on public.evaluation_test_cases to authenticated; grant select on public.evaluation_runs to authenticated; grant select on public.evaluation_run_events to authenticated;
create or replace function public.phase_v_evaluation_touch_updated_at() returns trigger language plpgsql security invoker set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists evaluation_test_cases_updated_at on public.evaluation_test_cases;
create trigger evaluation_test_cases_updated_at before update on public.evaluation_test_cases for each row execute function public.phase_v_evaluation_touch_updated_at();
