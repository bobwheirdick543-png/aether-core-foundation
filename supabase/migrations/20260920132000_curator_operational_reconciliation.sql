-- Keep the current Knowledge Curator contract active after the lifecycle audit fix.
-- The tested 1.1 contract is the current code-aligned version.
do $$
declare
  v_admin uuid;
  v_agent_id uuid;
  v_version_id uuid;
begin
  select ur.user_id into v_admin
  from public.user_roles ur
  where ur.role='admin'
  order by ur.granted_at
  limit 1;

  if v_admin is null then
    raise notice 'No administrator exists; curator activation remains available through the admin lifecycle workflow.';
    return;
  end if;

  select id into v_agent_id from public.agents where agent_key='curator';
  if v_agent_id is null then raise exception 'Curator agent is missing'; end if;

  select id into v_version_id
  from public.agent_versions
  where agent_id=v_agent_id and lifecycle_state='tested'
  order by created_at desc
  limit 1;

  if v_version_id is not null then
    update public.agent_versions av
    set definition = av.definition || jsonb_build_object(
      'status','enabled',
      'tools',to_jsonb(a.tools),
      'permissions',coalesce((
        select jsonb_agg(jsonb_build_object('permission',ap.permission,'allowed',ap.allowed,'requiresApproval',ap.requires_approval) order by ap.permission)
        from public.agent_permissions ap where ap.agent_id=a.id
      ),'[]'::jsonb)
    ),
    config_hash = md5((
      av.definition || jsonb_build_object(
        'status','enabled',
        'tools',to_jsonb(a.tools),
        'permissions',coalesce((
          select jsonb_agg(jsonb_build_object('permission',ap.permission,'allowed',ap.allowed,'requiresApproval',ap.requires_approval) order by ap.permission)
          from public.agent_permissions ap where ap.agent_id=a.id
        ),'[]'::jsonb)
      )
    )::text)
    from public.agents a
    where av.id=v_version_id and a.id=av.agent_id;

    perform public.agent_lifecycle_transition(v_version_id,'active',v_admin,'Activate current Knowledge Curator contract');
  end if;
end $$;
