-- Fix the lifecycle transition audit action contract.
-- The runtime action vocabulary uses "activated", not "active".
create or replace function public.agent_lifecycle_transition(
  p_version_id uuid,
  p_target_state text,
  p_actor_id uuid,
  p_reason text default null
)
returns public.agent_versions
language plpgsql
security definer
set search_path = public
as $function$
declare
  v public.agent_versions;
  prev public.agent_versions;
  v_action text;
begin
  if not public.has_role(p_actor_id,'admin') then
    raise exception 'Administrator authorization required';
  end if;

  select * into v from public.agent_versions where id=p_version_id for update;
  if not found then raise exception 'Agent version not found'; end if;

  if p_target_state='validated' and v.lifecycle_state<>'draft' then
    raise exception 'Only draft versions can be validated';
  end if;
  if p_target_state='tested' and v.lifecycle_state<>'validated' then
    raise exception 'Only validated versions can be tested';
  end if;
  if p_target_state='active' and v.lifecycle_state<>'tested' then
    raise exception 'Only tested versions can be activated';
  end if;
  if p_target_state in ('maintenance','disabled') and v.lifecycle_state not in ('active','maintenance','disabled','tested') then
    raise exception 'Version is not eligible for operational state change';
  end if;
  if p_target_state not in ('validated','tested','active','disabled','maintenance','rolled_back') then
    raise exception 'Invalid lifecycle target';
  end if;

  if p_target_state='active' then
    select * into prev
    from public.agent_versions
    where agent_id=v.agent_id and lifecycle_state='active' and id<>v.id
    order by activated_at desc nulls last
    limit 1;

    if prev.id is not null then
      update public.agent_versions
      set lifecycle_state='rolled_back', retired_at=now(),
          rollback_reason='Superseded by version '||v.version
      where id=prev.id;
    end if;

    update public.agents
    set config=v.definition, status='enabled',
        last_activity_at=now(), updated_at=now()
    where id=v.agent_id;

    update public.agent_versions
    set lifecycle_state='active', activated_by=p_actor_id,
        activated_at=now(), retired_at=null, rollback_reason=null
    where id=v.id;
    v_action := 'activated';

  elsif p_target_state='maintenance' then
    update public.agents set status='maintenance', updated_at=now() where id=v.agent_id;
    update public.agent_versions set lifecycle_state='maintenance' where id=v.id;
    v_action := 'maintenance';

  elsif p_target_state='disabled' then
    update public.agents set status='disabled', updated_at=now() where id=v.agent_id;
    update public.agent_versions set lifecycle_state='disabled', retired_at=coalesce(retired_at,now()) where id=v.id;
    v_action := 'disabled';

  elsif p_target_state='validated' then
    update public.agent_versions set lifecycle_state='validated', validated_by=p_actor_id, validated_at=now() where id=v.id;
    v_action := 'validated';

  elsif p_target_state='tested' then
    update public.agent_versions set lifecycle_state='tested', tested_by=p_actor_id, tested_at=now() where id=v.id;
    v_action := 'tested';

  else
    update public.agent_versions set lifecycle_state='rolled_back', retired_at=coalesce(retired_at,now()), rollback_reason=p_reason where id=v.id;
    v_action := 'rollback';
  end if;

  insert into public.agent_config_history(agent_id,version_id,action,after_config,actor_id,reason)
  values(v.agent_id,v.id,v_action,v.definition,p_actor_id,p_reason);

  select * into v from public.agent_versions where id=v.id;
  return v;
end;
$function$;
