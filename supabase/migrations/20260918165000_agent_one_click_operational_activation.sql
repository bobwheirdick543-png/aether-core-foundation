-- One-click operational activation for every Aether agent.
-- The administrator supplies only the agent key at the application layer.
-- This function performs the complete safety preflight and lifecycle activation atomically.

create or replace function public.agent_activate_operational(
  p_agent_id uuid,
  p_actor_id uuid,
  p_reason text default 'One-click administrator activation'
)
returns public.agent_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent public.agents;
  v_version public.agent_versions;
  v_previous public.agent_versions;
  v_definition jsonb;
  v_required text[] := array[
    'agent_id','version','name','description','mission','responsibilities',
    'prohibited','allowed_inputs','expected_outputs','tools','permissions',
    'timeout_policy','retry_policy','escalation_policy',
    'schedule_configuration','telemetry_configuration'
  ];
  v_key text;
  v_timeout numeric;
  v_permissions jsonb;
begin
  if not public.has_role(p_actor_id, 'admin') then
    raise exception 'Administrator authorization required';
  end if;

  select * into v_agent
  from public.agents
  where id = p_agent_id
  for update;

  if not found then
    raise exception 'Agent not found';
  end if;

  select * into v_version
  from public.agent_versions
  where agent_id = p_agent_id
    and lifecycle_state <> 'rolled_back'
  order by
    case when lifecycle_state = 'active' then 0 else 1 end,
    created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No agent contract is available. Initialize the contract before activation.';
  end if;

  v_definition := coalesce(v_version.definition, '{}'::jsonb);

  foreach v_key in array v_required loop
    if not (v_definition ? v_key) then
      raise exception 'Agent contract preflight failed: missing %', v_key;
    end if;
  end loop;

  if jsonb_typeof(v_definition->'responsibilities') <> 'array'
     or jsonb_typeof(v_definition->'prohibited') <> 'array'
     or jsonb_typeof(v_definition->'allowed_inputs') <> 'array'
     or jsonb_typeof(v_definition->'expected_outputs') <> 'array'
     or jsonb_typeof(v_definition->'tools') <> 'array'
     or jsonb_typeof(v_definition->'permissions') <> 'array' then
    raise exception 'Agent contract preflight failed: contract arrays are invalid';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements_text(v_definition->'prohibited') item
    where lower(item) like '%bypass authorization%'
  ) then
    raise exception 'Agent contract preflight failed: authorization boundary is missing';
  end if;

  v_timeout := nullif(v_definition->'timeout_policy'->>'timeoutMs','')::numeric;
  if v_timeout is null or v_timeout <= 0 or v_timeout > 18000000 then
    raise exception 'Agent contract preflight failed: timeout must be between 1ms and 5h';
  end if;

  v_permissions := v_definition->'permissions';
  if exists (
    select 1
    from jsonb_array_elements(v_permissions) permission
    where coalesce((permission->>'allowed')::boolean, false)
      and (
        lower(permission->>'permission') like '%roles.modify%'
        or lower(permission->>'permission') like '%permissions.self_modify%'
        or lower(permission->>'permission') like '%self_escalate%'
      )
  ) then
    raise exception 'Agent contract preflight failed: self-escalation permission detected';
  end if;

  select * into v_previous
  from public.agent_versions
  where agent_id = p_agent_id
    and lifecycle_state = 'active'
    and id <> v_version.id
  order by activated_at desc nulls last
  limit 1
  for update;

  if v_previous.id is not null then
    update public.agent_versions
    set lifecycle_state = 'rolled_back',
        retired_at = now(),
        rollback_reason = coalesce(p_reason, 'Superseded by one-click activation')
    where id = v_previous.id;
  end if;

  -- One-click activation may promote a draft/validated/tested/disabled/maintenance
  -- contract after the same server-side preflight. Manual Validate/Test remain
  -- available for explicit inspection but are not prerequisites for activation.
  update public.agent_versions
  set lifecycle_state = 'active',
      validated_by = coalesce(validated_by, p_actor_id),
      validated_at = coalesce(validated_at, now()),
      tested_by = coalesce(tested_by, p_actor_id),
      tested_at = coalesce(tested_at, now()),
      activated_by = p_actor_id,
      activated_at = now(),
      retired_at = null,
      rollback_reason = null
  where id = v_version.id;

  update public.agents
  set config = v_definition,
      status = 'enabled',
      last_activity_at = now(),
      updated_at = now()
  where id = p_agent_id;

  insert into public.agent_config_history(
    agent_id, version_id, action, before_config, after_config, actor_id, reason
  )
  values (
    p_agent_id,
    v_version.id,
    'activated',
    v_agent.config,
    v_definition,
    p_actor_id,
    coalesce(p_reason, 'One-click administrator activation')
  );

  select * into v_version
  from public.agent_versions
  where id = v_version.id;

  return v_version;
end;
$$;

revoke all on function public.agent_activate_operational(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.agent_activate_operational(uuid, uuid, text)
  to service_role;

create index if not exists agent_versions_operational_lookup_idx
  on public.agent_versions(agent_id, lifecycle_state, created_at desc);