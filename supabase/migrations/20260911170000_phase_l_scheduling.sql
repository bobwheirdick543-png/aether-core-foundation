-- AETHER PHASE L: durable scheduling and background automation foundation.
-- This migration is intentionally provider-independent and browser-independent.

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
  task_id uuid,
  task_run_id uuid,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(schedule_id,idempotency_key)
);

alter table public.scheduled_runs add column if not exists task_id uuid;
alter table public.scheduled_runs add column if not exists task_run_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='scheduled_runs_task_id_fkey') then
    alter table public.scheduled_runs add constraint scheduled_runs_task_id_fkey foreign key (task_id) references public.tasks(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='scheduled_runs_task_run_id_fkey') then
    alter table public.scheduled_runs add constraint scheduled_runs_task_run_id_fkey foreign key (task_run_id) references public.task_runs(id) on delete set null;
  end if;
end $$;

create index if not exists schedules_due_idx on public.schedules(enabled,next_run_at);
create index if not exists schedules_owner_idx on public.schedules(owner_id);
create index if not exists scheduled_runs_claim_idx on public.scheduled_runs(status,scheduled_for,lease_expires_at);
create index if not exists scheduled_runs_owner_idx on public.scheduled_runs(owner_id,created_at desc);
create index if not exists scheduled_runs_task_run_idx on public.scheduled_runs(task_run_id) where task_run_id is not null;

alter table public.schedules enable row level security;
alter table public.scheduled_runs enable row level security;

drop policy if exists schedules_select_own on public.schedules;
create policy schedules_select_own on public.schedules for select using(owner_id=auth.uid());
drop policy if exists schedules_insert_own on public.schedules;
create policy schedules_insert_own on public.schedules for insert with check(owner_id=auth.uid());
drop policy if exists schedules_update_own on public.schedules;
create policy schedules_update_own on public.schedules for update using(owner_id=auth.uid()) with check(owner_id=auth.uid());
drop policy if exists schedules_delete_own on public.schedules;
create policy schedules_delete_own on public.schedules for delete using(owner_id=auth.uid());

drop policy if exists scheduled_runs_select_own on public.scheduled_runs;
create policy scheduled_runs_select_own on public.scheduled_runs for select using(owner_id=auth.uid());
revoke all on public.scheduled_runs from anon,authenticated;

-- Five-field cron matcher. Day-of-week follows ISO semantics: 1=Monday ... 7=Sunday;
-- 0 is accepted as Sunday for compatibility. Lists, ranges and steps are supported.
create or replace function public.cron_field_matches(p_field text,p_value integer,p_min integer,p_max integer)
returns boolean language plpgsql immutable as $$
declare part text; base text; step integer; a integer; b integer; v integer;
begin
  if p_field is null or p_field='' or p_value<p_min or p_value>p_max then return false; end if;
  foreach part in array string_to_array(trim(p_field),',') loop
    if part='' then continue; end if;
    step:=1;
    if position('/' in part)>0 then
      if regexp_count(part,'/')<>1 then return false; end if;
      base:=split_part(part,'/',1);
      if split_part(part,'/',2) !~ '^\\d+$' then return false; end if;
      step:=split_part(part,'/',2)::integer;
      if step<1 then return false; end if;
    else base:=part; end if;
    if base='*' then a:=p_min; b:=p_max;
    elsif base~'^\\d+$' then a:=base::integer; b:=a;
    elsif base~'^\\d+-\\d+$' then a:=split_part(base,'-',1)::integer; b:=split_part(base,'-',2)::integer;
    else return false; end if;
    if p_min=1 and p_max=7 and a=0 then a:=7; if b=0 then b:=7; end if; end if;
    if a<p_min or b>p_max or a>b then return false; end if;
    for v in a..b loop if v=p_value and mod(v-a,step)=0 then return true; end if; end loop;
  end loop;
  return false;
exception when others then return false;
end;
$$;

create or replace function public.next_cron_run(p_expr text,p_after timestamptz,p_timezone text default 'UTC')
returns timestamptz language plpgsql immutable as $$
declare f text[]; cur timestamptz; local timestamp; i integer;
begin
  if p_expr is null or p_after is null then return null; end if;
  begin perform 1 from pg_timezone_names where name=p_timezone; if not found then return null; end if; exception when others then return null; end;
  f:=regexp_split_to_array(trim(p_expr),'\\s+');
  if array_length(f,1)<>5 then return null; end if;
  cur:=date_trunc('minute',p_after)+interval '1 minute';
  for i in 0..527039 loop
    local:=cur at time zone p_timezone;
    if public.cron_field_matches(f[1],extract(minute from local)::integer,0,59)
       and public.cron_field_matches(f[2],extract(hour from local)::integer,0,23)
       and public.cron_field_matches(f[3],extract(day from local)::integer,1,31)
       and public.cron_field_matches(f[4],extract(month from local)::integer,1,12)
       and public.cron_field_matches(f[5],extract(isodow from local)::integer,1,7) then return cur; end if;
    cur:=cur+interval '1 minute';
  end loop;
  return null;
end;
$$;

-- Claims due definitions and advances them exactly once. New scheduled work starts queued;
-- the separate dispatcher atomically hands it to the common Phase A runtime.
create or replace function public.claim_due_schedules(p_limit integer default 10,p_lease_seconds integer default 120)
returns setof public.scheduled_runs language plpgsql security definer set search_path=public as $$
declare r record; v_run public.scheduled_runs; v_next timestamptz;
begin
  for r in select * from public.schedules where enabled and next_run_at is not null and next_run_at<=now() order by next_run_at asc for update skip locked limit greatest(1,least(p_limit,50)) loop
    insert into public.scheduled_runs(schedule_id,owner_id,status,scheduled_for,max_attempts,payload,idempotency_key)
    values(r.id,r.owner_id,'queued',r.next_run_at,3,r.payload,'schedule:'||r.id::text||':'||to_char(r.next_run_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    on conflict(schedule_id,idempotency_key) do nothing returning * into v_run;
    if v_run.id is not null then
      v_next:=case
        when r.schedule_kind='once' then null
        when r.schedule_kind='interval' and r.schedule_expression~'^\\d+$' then greatest(r.next_run_at+(r.schedule_expression::integer*interval '1 second'),now()+interval '1 second')
        when r.schedule_kind='cron' then public.next_cron_run(r.schedule_expression,r.next_run_at,r.timezone)
        else null end;
      update public.schedules set last_run_at=v_run.scheduled_for,last_run_id=v_run.id,next_run_at=v_next,enabled=case when v_next is null then false else enabled end,updated_at=now() where id=r.id;
      return next v_run;
    end if;
  end loop;
  return;
end;
$$;

-- Atomically claims queued scheduled runs and creates durable Phase A tasks/task-runs.
-- This is the scheduler -> runtime handoff; no browser is involved.
create or replace function public.claim_queued_scheduled_runs(p_limit integer default 10,p_lease_seconds integer default 120)
returns setof public.scheduled_runs language plpgsql security definer set search_path=public as $$
declare r public.scheduled_runs; v_task public.tasks; v_task_run public.task_runs; v_now timestamptz:=now(); v_lease timestamptz;
begin
  v_lease:=v_now+make_interval(secs=>greatest(30,least(p_lease_seconds,900)));
  for r in select * from public.scheduled_runs where status='queued' order by scheduled_for asc,created_at asc for update skip locked limit greatest(1,least(p_limit,50)) loop
    insert into public.tasks(user_id,project_id,title,kind,status,progress,detail,priority,idempotency_key,timeout_ms,max_retries)
    values(r.owner_id,null,'Scheduled: '||r.id::text,(select s.task_type from public.schedules s where s.id=r.schedule_id),'queued',0,r.payload,0,'scheduled-task:'||r.id::text,300000,greatest(0,r.max_attempts-1))
    on conflict(idempotency_key) do update set updated_at=now()
    returning * into v_task;
    insert into public.task_runs(task_id,owner_id,agent_id,attempt,status,inputs,outputs,idempotency_key,timeout_ms,max_retries,next_attempt_at)
    values(v_task.id,r.owner_id,null,1,'queued',r.payload,'{}'::jsonb,'scheduled-run-task:'||r.id::text,300000,greatest(0,r.max_attempts-1),null)
    on conflict(idempotency_key) do nothing returning * into v_task_run;
    if v_task_run.id is null then select * into v_task_run from public.task_runs where idempotency_key='scheduled-run-task:'||r.id::text; end if;
    update public.scheduled_runs set status='running',task_id=v_task.id,task_run_id=v_task_run.id,lease_token=gen_random_uuid(),lease_expires_at=v_lease,started_at=coalesce(started_at,v_now),updated_at=v_now where id=r.id returning * into r;
    return next r;
  end loop;
  return;
end;
$$;

-- Scheduled-run lease recovery is separate from Phase A runtime recovery. It only governs
-- the scheduler handoff and never bypasses the common task/run retry/dead-letter policy.
create or replace function public.recover_expired_scheduled_runs(p_limit integer default 50)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  update public.scheduled_runs set status=case when attempt_count+1>=max_attempts then 'failed' else 'queued' end,
    attempt_count=attempt_count+1,
    error=case when attempt_count+1>=max_attempts then 'Scheduler worker lease expired after maximum attempts' else 'Scheduler worker lease expired; run requeued' end,
    lease_token=null,lease_expires_at=null,started_at=null,updated_at=now()
  where id in (select id from public.scheduled_runs where status='running' and lease_expires_at is not null and lease_expires_at<now() order by lease_expires_at asc limit greatest(1,least(p_limit,100)));
  get diagnostics n=row_count; return n;
end;
$$;

-- Reflect terminal common-runtime outcomes back to the durable scheduled-run record.
create or replace function public.sync_scheduled_run_from_task_run()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status in ('succeeded','failed','cancelled') then
    update public.scheduled_runs
      set status=case when new.status='succeeded' then 'succeeded' when new.status='cancelled' then 'cancelled' else 'failed' end,
          finished_at=coalesce(finished_at,now()),
          result=case when new.status='succeeded' then coalesce(new.outputs,'{}'::jsonb) else result end,
          error=case when new.status='succeeded' then null else coalesce(new.error,new.failure_code) end,
          lease_token=null,lease_expires_at=null,updated_at=now()
    where task_run_id=new.id and status='running';
  end if;
  return new;
end;
$$;

drop trigger if exists task_run_scheduled_sync on public.task_runs;
create trigger task_run_scheduled_sync after update of status on public.task_runs for each row execute function public.sync_scheduled_run_from_task_run();

revoke all on function public.claim_due_schedules(integer,integer) from public,anon,authenticated;
revoke all on function public.claim_queued_scheduled_runs(integer,integer) from public,anon,authenticated;
revoke all on function public.recover_expired_scheduled_runs(integer) from public,anon,authenticated;
revoke all on function public.next_cron_run(text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.cron_field_matches(text,integer,integer,integer) from public,anon,authenticated;
revoke all on function public.sync_scheduled_run_from_task_run() from public,anon,authenticated;
grant execute on function public.claim_due_schedules(integer,integer) to service_role;
grant execute on function public.claim_queued_scheduled_runs(integer,integer) to service_role;
grant execute on function public.recover_expired_scheduled_runs(integer) to service_role;
