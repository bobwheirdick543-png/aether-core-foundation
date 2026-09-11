-- Phase L: durable scheduling/background automation.
-- Scheduler state is database-backed so browser lifecycle/restarts never own job state.
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  description text,
  schedule_kind text not null check (schedule_kind in ('once','interval','cron')),
  schedule_expression text not null check (char_length(schedule_expression) between 1 and 200),
  timezone text not null default 'UTC',
  payload jsonb not null default '{}'::jsonb,
  task_type text not null check (char_length(task_type) between 1 and 120),
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_runs (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  scheduled_for timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 20),
  lease_token uuid,
  lease_expires_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, idempotency_key)
);

create index if not exists schedules_due_idx on public.schedules(enabled, next_run_at);
create index if not exists schedules_owner_idx on public.schedules(owner_id);
create index if not exists scheduled_runs_claim_idx on public.scheduled_runs(status, scheduled_for, lease_expires_at);
create index if not exists scheduled_runs_owner_idx on public.scheduled_runs(owner_id, created_at desc);

alter table public.schedules enable row level security;
alter table public.scheduled_runs enable row level security;
drop policy if exists schedules_select_own on public.schedules;
create policy schedules_select_own on public.schedules for select using (owner_id=auth.uid());
drop policy if exists schedules_insert_own on public.schedules;
create policy schedules_insert_own on public.schedules for insert with check (owner_id=auth.uid());
drop policy if exists schedules_update_own on public.schedules;
create policy schedules_update_own on public.schedules for update using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists schedules_delete_own on public.schedules;
create policy schedules_delete_own on public.schedules for delete using (owner_id=auth.uid());
drop policy if exists scheduled_runs_select_own on public.scheduled_runs;
create policy scheduled_runs_select_own on public.scheduled_runs for select using (owner_id=auth.uid());
revoke all on public.scheduled_runs from anon, authenticated;

-- Server workers use the service role. This function claims a due schedule atomically,
-- creates a durable run with an idempotency key, and advances the schedule cursor.
create or replace function public.claim_due_schedules(p_limit integer default 10, p_lease_seconds integer default 120)
returns setof public.scheduled_runs
language plpgsql
security definer
set search_path = public
as $$
declare r record; v_run public.scheduled_runs;
begin
  for r in
    select * from public.schedules
    where enabled and next_run_at is not null and next_run_at <= now()
    order by next_run_at asc
    for update skip locked
    limit greatest(1, least(p_limit, 50))
  loop
    insert into public.scheduled_runs(schedule_id, owner_id, status, scheduled_for, max_attempts, payload, idempotency_key, lease_token, lease_expires_at)
    values (r.id, r.owner_id, 'running', r.next_run_at, 3, r.payload, to_char(r.next_run_at at time zone 'UTC','YYYYMMDDHH24MISSMSOF'), gen_random_uuid(), now() + make_interval(secs => greatest(30, least(p_lease_seconds, 900))))
    on conflict (schedule_id, idempotency_key) do nothing
    returning * into v_run;

    if v_run.id is not null then
      update public.schedules
      set last_run_at=v_run.scheduled_for,
          last_run_id=v_run.id,
          next_run_at=case
            when schedule_kind='once' then null
            when schedule_kind='interval' then greatest(next_run_at + (schedule_expression || ' seconds')::interval, now() + interval '1 second')
            else next_run_at
          end,
          enabled=case when schedule_kind='once' then false else enabled end,
          updated_at=now()
      where id=r.id;
      return next v_run;
    end if;
  end loop;
  return;
end;
$$;
revoke all on function public.claim_due_schedules(integer,integer) from public, anon, authenticated;
