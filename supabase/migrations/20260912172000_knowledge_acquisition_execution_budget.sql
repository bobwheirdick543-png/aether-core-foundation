begin;

create or replace function public.prepare_knowledge_acquisition_task_deadline()
returns trigger language plpgsql set search_path=public as $function$
declare v_budget bigint;
begin
  if new.kind='knowledge-acquisition' then
    v_budget := greatest(300000, least(3600000, coalesce((new.detail->>'time_budget_ms')::bigint, 900000)));
    if new.status in ('queued','scheduled','paused','retrying') then
      new.timeout_ms := greatest(coalesce(new.timeout_ms,0),18000000);
      new.deadline_at := now()+interval '5 hours';
    elsif new.status='running' then
      new.timeout_ms := greatest(coalesce(new.timeout_ms,0),18000000);
      new.deadline_at := now()+make_interval(secs=>v_budget/1000.0);
    end if;
  end if;
  return new;
end;$function$;

create or replace function public.prepare_knowledge_acquisition_run_deadline()
returns trigger language plpgsql set search_path=public as $function$
declare v_budget bigint;
begin
  if new.agent_key='knowledge-acquisition' and new.status='running' then
    select greatest(300000, least(3600000, coalesce((detail->>'time_budget_ms')::bigint, 900000))) into v_budget from public.tasks where id=new.task_id;
    new.timeout_ms := greatest(coalesce(new.timeout_ms,0),18000000);
    new.deadline_at := now()+make_interval(secs=>coalesce(v_budget,900000)/1000.0);
  end if;
  return new;
end;$function$;

drop trigger if exists knowledge_acquisition_queue_deadline on public.tasks;
create trigger knowledge_acquisition_queue_deadline before insert or update of status on public.tasks for each row execute function public.prepare_knowledge_acquisition_task_deadline();
drop trigger if exists knowledge_acquisition_run_deadline on public.task_runs;
create trigger knowledge_acquisition_run_deadline before insert or update of status on public.task_runs for each row execute function public.prepare_knowledge_acquisition_run_deadline();

revoke all on function public.prepare_knowledge_acquisition_task_deadline() from public,anon,authenticated;
revoke all on function public.prepare_knowledge_acquisition_run_deadline() from public,anon,authenticated;
grant execute on function public.prepare_knowledge_acquisition_task_deadline() to service_role;
grant execute on function public.prepare_knowledge_acquisition_run_deadline() to service_role;

insert into supabase_migrations.schema_migrations(version,statements,name,created_by,idempotency_key,rollback)
select '20260912172000',array['queued acquisition retains a 5h scheduler lease window','running acquisition receives its configured 5m-60m execution deadline','task and run deadlines are both reset at actual worker claim time'],'knowledge_acquisition_execution_budget','bobwheirdick543@gmail.com',null,array[]::text[]
where not exists(select 1 from supabase_migrations.schema_migrations where version='20260912172000');

commit;