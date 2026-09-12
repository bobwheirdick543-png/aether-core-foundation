create or replace function public.link_knowledge_acquisition_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((new.metadata->>'kind'), '') = 'knowledge-acquisition' then
    update public.aether_knowledge_acquisition_jobs
       set report_ids = array_append(coalesce(report_ids, '{}'::uuid[]), new.id),
           updated_at = now()
     where id = nullif(new.metadata->>'acquisitionJobId','')::uuid
       and not (new.id = any(coalesce(report_ids, '{}'::uuid[])));
  end if;
  return new;
end;
$$;

drop trigger if exists reports_link_knowledge_acquisition on public.reports;
create trigger reports_link_knowledge_acquisition
after insert on public.reports
for each row execute function public.link_knowledge_acquisition_report();

revoke all on function public.link_knowledge_acquisition_report() from public;
revoke all on function public.link_knowledge_acquisition_report() from anon;
revoke all on function public.link_knowledge_acquisition_report() from authenticated;
