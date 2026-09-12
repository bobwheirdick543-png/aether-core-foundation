begin;

create or replace function public.sync_knowledge_acquisition_provenance()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_job public.aether_knowledge_acquisition_jobs;
  v_session_id uuid;
  v_source_ids uuid[];
begin
  if new.provenance ? 'acquisitionJobId' then
    select * into v_job
    from public.aether_knowledge_acquisition_jobs
    where id = nullif(new.provenance->>'acquisitionJobId','')::uuid;
    if v_job.id is not null then
      select id into v_session_id
      from public.aether_research_sessions
      where task_id = v_job.task_id and run_id = v_job.run_id
      order by started_at desc
      limit 1;
      if v_session_id is not null then
        select coalesce(array_agg(id order by retrieved_at desc), '{}'::uuid[])
          into v_source_ids
        from public.aether_research_sources
        where session_id = v_session_id and owner_id = new.owner_id;
        update public.aether_knowledge_candidates
        set source_ids = v_source_ids,
            source_metadata = coalesce((select jsonb_agg(jsonb_build_object(
              'sourceId', s.id, 'url', s.url, 'canonicalUrl', s.canonical_url,
              'title', s.title, 'domain', s.domain, 'retrievedAt', s.retrieved_at,
              'publishedAt', s.published_at, 'qualityScore', s.quality_score,
              'staleAt', s.stale_at
            ) order by s.retrieved_at desc) from public.aether_research_sources s where s.session_id=v_session_id and s.owner_id=new.owner_id), '[]'::jsonb)
        where id = new.id;
        insert into public.aether_knowledge_provenance(candidate_id,owner_id,project_id,source_type,source_id,source_url,verification_run_id,evidence_ids,metadata)
        select new.id,new.owner_id,new.project_id,'research',s.id,s.url,null,'{}'::uuid[],jsonb_build_object('acquisitionJobId',v_job.id,'researchSessionId',v_session_id)
        from public.aether_research_sources s
        where s.session_id=v_session_id and s.owner_id=new.owner_id
        on conflict do nothing;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists knowledge_acquisition_provenance_sync on public.aether_knowledge_candidates;
create trigger knowledge_acquisition_provenance_sync
after insert on public.aether_knowledge_candidates
for each row execute function public.sync_knowledge_acquisition_provenance();

revoke all on function public.sync_knowledge_acquisition_provenance() from public, anon, authenticated;

grant execute on function public.sync_knowledge_acquisition_provenance() to service_role;

commit;