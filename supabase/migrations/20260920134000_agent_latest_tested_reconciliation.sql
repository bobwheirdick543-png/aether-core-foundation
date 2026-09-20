-- Keep every registered Aether agent on its latest tested operational contract.
-- This reconciles both the ten core agents and the Safety Bin Recycling Agent.
do $$
declare
  v_admin uuid;
  v_key text;
  v_agent_id uuid;
  v_active public.agent_versions;
  v_latest_tested public.agent_versions;
begin
  select ur.user_id into v_admin
  from public.user_roles ur
  where ur.role = 'admin'
  order by ur.granted_at
  limit 1;

  if v_admin is null then
    raise notice 'No permanent administrator exists; agent lifecycle activation remains an admin workflow.';
    return;
  end if;

  foreach v_key in array array[
    'orchestrator',
    'research',
    'verification',
    'knowledge-acquisition',
    'curator',
    'report',
    'notification',
    'security',
    'optimization',
    'module',
    'recycling'
  ] loop
    select id into v_agent_id from public.agents where agent_key = v_key;
    if v_agent_id is null then
      raise exception 'Agent reconciliation failed: missing agent %', v_key;
    end if;

    select * into v_active
    from public.agent_versions
    where agent_id = v_agent_id
      and lifecycle_state = 'active'
    order by activated_at desc nulls last, created_at desc
    limit 1;

    select * into v_latest_tested
    from public.agent_versions
    where agent_id = v_agent_id
      and lifecycle_state = 'tested'
    order by created_at desc
    limit 1;

    if v_latest_tested.id is not null and (v_active.id is null or v_active.id <> v_latest_tested.id) then
      if v_active.id is not null then
        perform public.agent_set_operational_state(
          v_agent_id,
          'maintenance',
          v_admin,
          'Rotate to latest tested agent contract'
        );
      end if;
      perform public.agent_activate_operational(
        v_agent_id,
        v_admin,
        'Activate latest tested agent contract'
      );
    elsif v_active.id is null then
      if exists (
        select 1 from public.agent_versions
        where agent_id = v_agent_id
          and lifecycle_state in ('validated','disabled','maintenance','draft','tested')
      ) then
        perform public.agent_activate_operational(
          v_agent_id,
          v_admin,
          'Initialize active agent contract'
        );
      else
        raise exception 'Agent reconciliation failed: no usable version for %', v_key;
      end if;
    end if;
  end loop;
end $$;
