create or replace function public.aether_queue_knowledge_reindex() returns trigger language plpgsql security definer set search_path = public as $$
declare collection_project uuid;
begin
  if new.stage <> 'production' then return new; end if;
  select project_id into collection_project from public.knowledge_collections where id = new.collection_id and owner_id = new.owner_id;
  if tg_op = 'INSERT' or new.current_version is distinct from old.current_version or new.body is distinct from old.body or new.stage is distinct from old.stage then
    update public.aether_knowledge_chunks set is_current = false, updated_at = now() where entry_id = new.id and owner_id = new.owner_id;
    insert into public.aether_retrieval_index_jobs(owner_id, project_id, entry_id, target_version, reason)
    select new.owner_id, collection_project, new.id, new.current_version, case when tg_op = 'INSERT' then 'production-entry-created' else 'production-entry-changed' end
    where not exists (select 1 from public.aether_retrieval_index_jobs j where j.owner_id = new.owner_id and j.entry_id = new.id and j.target_version = new.current_version and j.status in ('queued','running'));
  end if;
  return new;
end; $$;
drop trigger if exists aether_knowledge_reindex_trigger on public.knowledge_entries;
create trigger aether_knowledge_reindex_trigger after insert or update of body, stage, current_version on public.knowledge_entries for each row execute function public.aether_queue_knowledge_reindex();
revoke all on function public.aether_queue_knowledge_reindex() from public;
