create index if not exists ai_stat_register_entity_created_idx on public.ai_stat_register(entity_type, entity_id, created_at desc);
create index if not exists ai_stat_current_entity_metric_idx on public.ai_stat_current(entity_type, entity_id, metric_key);

create or replace function public.record_ai_stat_change(
  p_entity_type text, p_entity_id uuid, p_metric_key text, p_delta numeric,
  p_reason text, p_evidence jsonb default '{}'::jsonb,
  p_task_id uuid default null, p_run_id uuid default null,
  p_knowledge_event_id uuid default null, p_evaluation_id uuid default null
) returns public.ai_stat_register
language plpgsql security definer set search_path = public as $$
declare v_previous numeric; v_new numeric; v_row public.ai_stat_register; v_allowed boolean := false;
begin
  if auth.role() = 'service_role' then v_allowed := true; else select public.has_role(auth.uid(), 'admin') into v_allowed; end if;
  if not coalesce(v_allowed,false) then raise exception 'Forbidden'; end if;
  if p_entity_type not in ('agent','aax_model') then raise exception 'Unsupported AI entity type'; end if;
  if p_metric_key is null or btrim(p_metric_key)='' then raise exception 'Metric is required'; end if;
  if p_delta is null or p_delta=0 then raise exception 'Stat delta must be non-zero and evidence-backed'; end if;
  if p_reason is null or btrim(p_reason)='' then raise exception 'Reason is required'; end if;
  if p_evidence is null or jsonb_typeof(p_evidence)<>'object' then raise exception 'Evidence must be a JSON object'; end if;
  if p_task_id is null and p_run_id is null and p_knowledge_event_id is null and p_evaluation_id is null then raise exception 'At least one durable evidence reference is required'; end if;
  select value into v_previous from public.ai_stat_current where entity_type=p_entity_type and entity_id=p_entity_id and metric_key=p_metric_key for update;
  if v_previous is null then v_previous:=0; end if;
  v_new:=v_previous+p_delta;
  insert into public.ai_stat_current(entity_type,entity_id,metric_key,value,updated_at) values(p_entity_type,p_entity_id,p_metric_key,v_new,now()) on conflict(entity_type,entity_id,metric_key) do update set value=excluded.value,updated_at=now();
  insert into public.ai_stat_register(entity_type,entity_id,metric_key,previous_value,delta,new_value,evidence,reason,task_id,run_id,knowledge_event_id,evaluation_id) values(p_entity_type,p_entity_id,p_metric_key,v_previous,p_delta,v_new,p_evidence,p_reason,p_task_id,p_run_id,p_knowledge_event_id,p_evaluation_id) returning * into v_row;
  return v_row;
end; $$;

revoke all on function public.record_ai_stat_change(text,uuid,text,numeric,text,jsonb,uuid,uuid,uuid,uuid) from public;
grant execute on function public.record_ai_stat_change(text,uuid,text,numeric,text,jsonb,uuid,uuid,uuid,uuid) to authenticated, service_role;
