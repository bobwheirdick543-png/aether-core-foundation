-- AETHER: correct one-click activation auto-initialization guard.
CREATE OR REPLACE FUNCTION public.agent_activate_operational(
  p_agent_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT 'One-click administrator activation'
)
RETURNS public.agent_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent public.agents;
  v_version public.agent_versions;
  v_previous public.agent_versions;
  v_definition jsonb;
  v_permissions jsonb;
  v_defaults jsonb;
  v_required text[] := ARRAY['agent_id','version','name','description','mission','responsibilities','prohibited','allowed_inputs','expected_outputs','tools','permissions','timeout_policy','retry_policy','escalation_policy','schedule_configuration','telemetry_configuration'];
  v_key text;
  v_timeout numeric;
BEGIN
  IF NOT public.has_role(p_actor_id,'admin') THEN RAISE EXCEPTION 'Administrator authorization required'; END IF;
  SELECT * INTO v_agent FROM public.agents WHERE id=p_agent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agent not found'; END IF;

  SELECT * INTO v_version
  FROM public.agent_versions
  WHERE agent_id=p_agent_id AND lifecycle_state <> 'rolled_back'
  ORDER BY CASE WHEN lifecycle_state='active' THEN 0 ELSE 1 END, created_at DESC
  LIMIT 1 FOR UPDATE;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('permission',ap.permission,'allowed',ap.allowed,'requiresApproval',ap.requires_approval) ORDER BY ap.permission),'[]'::jsonb)
  INTO v_permissions
  FROM public.agent_permissions ap WHERE ap.agent_id=p_agent_id;

  v_defaults := jsonb_build_object(
    'agent_id','agent_'||v_agent.agent_key,
    'version',COALESCE(v_version.version,'1.0.0'),
    'name',v_agent.name,
    'description',COALESCE(v_agent.description,v_agent.purpose,''),
    'mission',COALESCE(v_agent.purpose,v_agent.description,''),
    'responsibilities',COALESCE(to_jsonb(v_agent.tools),'[]'::jsonb),
    'prohibited',jsonb_build_array('Bypass authorization','Modify roles','Self-escalate permissions'),
    'allowed_inputs',jsonb_build_array('task_context','previous_results'),
    'expected_outputs',jsonb_build_array('result','status','requires_review'),
    'tools',COALESCE(to_jsonb(v_agent.tools),'[]'::jsonb),
    'permissions',v_permissions,
    'timeout_policy',jsonb_build_object('timeoutMs',300000,'maxRetries',3,'backoffMs',5000,'escalateOnFailure',true,'escalateTo','admin'),
    'retry_policy',jsonb_build_object('timeoutMs',300000,'maxRetries',3,'backoffMs',5000,'escalateOnFailure',true,'escalateTo','admin'),
    'escalation_policy',jsonb_build_object('timeoutMs',300000,'maxRetries',2,'backoffMs',5000,'escalateOnFailure',true,'escalateTo','admin'),
    'schedule_configuration',jsonb_build_object('enabled',false),
    'telemetry_configuration',jsonb_build_object('collectMetrics',true,'collectTimeline',true,'retainDays',90)
  );

  IF v_version.id IS NULL THEN
    v_definition := v_defaults;
    INSERT INTO public.agent_versions(agent_id,version,lifecycle_state,definition,config_hash,created_by)
    VALUES(p_agent_id,'1.0.0','draft',v_definition,md5(v_definition::text),p_actor_id)
    ON CONFLICT(agent_id,version) DO UPDATE SET definition=EXCLUDED.definition,config_hash=EXCLUDED.config_hash
    RETURNING * INTO v_version;
  END IF;

  v_definition := v_defaults || COALESCE(v_version.definition,'{}'::jsonb);
  v_definition := jsonb_set(v_definition,'{agent_id}',to_jsonb(('agent_'||v_agent.agent_key)::text),true);
  v_definition := jsonb_set(v_definition,'{version}',to_jsonb(v_version.version::text),true);

  FOREACH v_key IN ARRAY v_required LOOP
    IF NOT (v_definition ? v_key) THEN RAISE EXCEPTION 'Agent contract preflight failed: missing %',v_key; END IF;
  END LOOP;

  IF jsonb_typeof(v_definition->'responsibilities')<>'array'
     OR jsonb_typeof(v_definition->'prohibited')<>'array'
     OR jsonb_typeof(v_definition->'allowed_inputs')<>'array'
     OR jsonb_typeof(v_definition->'expected_outputs')<>'array'
     OR jsonb_typeof(v_definition->'tools')<>'array'
     OR jsonb_typeof(v_definition->'permissions')<>'array'
  THEN RAISE EXCEPTION 'Agent contract preflight failed: contract arrays are invalid'; END IF;

  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_definition->'prohibited') item WHERE lower(item) LIKE '%bypass authorization%')
    THEN RAISE EXCEPTION 'Agent contract preflight failed: authorization boundary is missing'; END IF;

  v_timeout := NULLIF(v_definition->'timeout_policy'->>'timeoutMs','')::numeric;
  IF v_timeout IS NULL OR v_timeout <= 0 OR v_timeout > 18000000
    THEN RAISE EXCEPTION 'Agent contract preflight failed: timeout must be between 1ms and 5h'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_definition->'permissions') permission
    WHERE COALESCE((permission->>'allowed')::boolean,false)
      AND (lower(permission->>'permission') LIKE '%roles.modify%'
        OR lower(permission->>'permission') LIKE '%permissions.self_modify%'
        OR lower(permission->>'permission') LIKE '%self_escalate%')
  ) THEN RAISE EXCEPTION 'Agent contract preflight failed: self-escalation permission detected'; END IF;

  SELECT * INTO v_previous FROM public.agent_versions
  WHERE agent_id=p_agent_id AND lifecycle_state='active' AND id<>v_version.id
  ORDER BY activated_at DESC NULLS LAST LIMIT 1 FOR UPDATE;

  IF v_previous.id IS NOT NULL THEN
    UPDATE public.agent_versions SET lifecycle_state='rolled_back',retired_at=now(),rollback_reason=COALESCE(p_reason,'Superseded by one-click activation') WHERE id=v_previous.id;
  END IF;

  UPDATE public.agent_versions
  SET lifecycle_state='active',definition=v_definition,config_hash=md5(v_definition::text),
      validated_by=COALESCE(validated_by,p_actor_id),validated_at=COALESCE(validated_at,now()),
      tested_by=COALESCE(tested_by,p_actor_id),tested_at=COALESCE(tested_at,now()),
      activated_by=p_actor_id,activated_at=now(),retired_at=NULL,rollback_reason=NULL
  WHERE id=v_version.id;

  UPDATE public.agents SET config=v_definition,status='enabled',last_activity_at=now(),updated_at=now() WHERE id=p_agent_id;

  INSERT INTO public.agent_config_history(agent_id,version_id,action,before_config,after_config,actor_id,reason)
  VALUES(p_agent_id,v_version.id,'activated',v_agent.config,v_definition,p_actor_id,COALESCE(p_reason,'One-click administrator activation'));

  SELECT * INTO v_version FROM public.agent_versions WHERE id=v_version.id;
  RETURN v_version;
END;
$$;
REVOKE ALL ON FUNCTION public.agent_activate_operational(uuid,uuid,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.agent_activate_operational(uuid,uuid,text) TO service_role;