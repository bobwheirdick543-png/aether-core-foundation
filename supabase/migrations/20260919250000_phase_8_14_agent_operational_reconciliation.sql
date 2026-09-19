-- Roadmap 8-14 operational reconciliation.
-- Keep the ten core agents enabled after deployment when a permanent administrator
-- already exists. Activation still passes through the server-side contract preflight
-- and lifecycle machinery; this does not grant agents self-escalation permissions.
do $$
declare
  v_admin uuid;
  v_key text;
  v_agent_id uuid;
begin
  select ur.user_id
    into v_admin
  from public.user_roles ur
  where ur.role = 'admin'
  order by ur.created_at
  limit 1;

  if v_admin is null then
    raise notice 'No permanent administrator exists yet; agent activation will occur through the admin activation workflow.';
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
    'module'
  ] loop
    select id into v_agent_id from public.agents where agent_key = v_key;
    if v_agent_id is null then
      raise exception 'Roadmap 8-14 reconciliation failed: missing agent %', v_key;
    end if;

    if exists (
      select 1
      from public.agent_versions
      where agent_id = v_agent_id
        and lifecycle_state <> 'rolled_back'
    ) then
      perform public.agent_activate_operational(
        v_agent_id,
        v_admin,
        'Roadmap 8-14 operational reconciliation'
      );
    else
      raise exception 'Roadmap 8-14 reconciliation failed: no version for agent %', v_key;
    end if;
  end loop;
end $$;
