begin;

create or replace function public.prepare_knowledge_acquisition_task_deadline()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if new.kind = 'knowledge-acquisition' and new.status in ('queued','scheduled','paused','retrying') then
    new.timeout_ms := greatest(coalesce(new.timeout_ms, 0), 18000000);
    new.deadline_at := now() + interval '5 hours';
  end if;
  return new;
end;
$function$;

drop trigger if exists knowledge_acquisition_queue_deadline on public.tasks;
create trigger knowledge_acquisition_queue_deadline
before insert or update of status on public.tasks
for each row execute function public.prepare_knowledge_acquisition_task_deadline();

revoke all on function public.prepare_knowledge_acquisition_task_deadline() from public,anon,authenticated;

grant execute on function public.prepare_knowledge_acquisition_task_deadline() to service_role;

insert into supabase_migrations.schema_migrations(version,statements,name,created_by,idempotency_key,rollback)
select '20260912171500',array['queue deadline for knowledge-acquisition is held at 5h so the mission budget begins at worker execution'],'knowledge_acquisition_queue_deadline','bobwheirdick543@gmail.com',null,array[]::text[]
where not exists(select 1 from supabase_migrations.schema_migrations where version='20260912171500');

commit;