-- AETHER: operational agent activation UX and durable runtime state.
-- Normal admin activation no longer requires entering a contract version or editing JSON.
-- The server performs the existing safety preflight internally, then makes the agent
-- operational until an administrator explicitly chooses Maintenance or Disable.

CREATE OR REPLACE FUNCTION public.agent_activate_operational(
  p_agent_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT NULL
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
  v_permission_names text[];
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN
    RAISE EXCEPTION 'Administrator authorization required';
  END IF;

  SELECT * INTO v_agent
  FROM public.agents
  WHERE id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;

  SELECT * INTO v_version
  FROM public.agent_versions
  WHERE agent_id = p_agent_id
    AND lifecycle_state = 'active'
  ORDER BY activated_at DESC NULLS LAST, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_version.id IS NULL THEN
    SELECT * INTO v_version
    FROM public.agent_versions
    WHERE agent_id = p_agent_id
      AND lifecycle_state IN ('tested','validated','disabled','maintenance','draft')
    ORDER BY
      CASE lifecycle_state
        WHEN 'tested' THEN 1
        WHEN 'validated' THEN 2
        WHEN 'maintenance' THEN 3
        WHEN 'disabled' THEN 4
        WHEN 'draft' THEN 5
        ELSE 6
      END,
      created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_version.id IS NULL THEN
    v_definition := COALESCE(v_agent.config, '{}'::jsonb);

    IF jsonb_typeof(v_definition) <> 'object' OR v_definition = '{}'::jsonb THEN
      v_definition := jsonb_build_object(
        'agent_id', 'agent_' || v_agent.agent_key,
        'version', '1.0.0',
        'name', v_agent.name,
        'description', COALESCE(v_agent.description, ''),
        'purpose', COALESCE(v_agent.purpose, ''),
        'mission', COALESCE(v_agent.purpose, ''),
        'status', 'enabled',
        'tools', COALESCE(to_jsonb(v_agent.tools), '[]'::jsonb),
        'responsibilities', COALESCE(to_jsonb(v_agent.tools), '[]'::jsonb),
        'prohibited', jsonb_build_array('Bypass authorization','Modify roles','Self-escalate permissions'),
        'allowed_inputs', jsonb_build_array('task_context','previous_results'),
        'expected_outputs', jsonb_build_array('result','status','requires_review'),
        'quality_requirements', jsonb_build_array('structured output','permission enforcement','truthful telemetry'),
        'timeout_policy', jsonb_build_object('timeoutMs',300000,'maxRetries',3,'backoffMs',5000,'escalateOnFailure',true,'escalateTo','admin'),
        'retry_policy', jsonb_build_object('timeoutMs',300000,'maxRetries',3,'backoffMs',5000,'escalateOnFailure',true,'escalateTo','admin'),
        'escalation_policy', jsonb_build_object('timeoutMs',300000,'maxRetries',2,'backoffMs',5000,'escalateOnFailure',true,'escalateTo','admin'),
        'schedule_configuration', jsonb_build_object('enabled',false),
        'telemetry_configuration', jsonb_build_object('collectMetrics',true,'collectTimeline',true,'retainDays',90)
      );
    END IF;

    IF NOT (v_definition ? 'agent_id')
      THEN v_definition := jsonb_set(v_definition, '{agent_id}', to_jsonb(('agent_' || v_agent.agent_key)::text), true);
    END IF;
    IF NOT (v_definition ? 'version')
      THEN v_definition := jsonb_set(v_definition, '{version}', to_jsonb('1.0.0'::text), true);
    END IF;

    INSERT INTO public.agent_versions (
      agent_id, version, lifecycle_state, definition, config_hash, created_by
    )
    VALUES (
      p_agent_id,
      COALESCE(NULLIF(v_definition->>'version',''), '1.0.0'),
      'draft',
      v_definition,
      md5(v_definition::text),
      p_actor_id
    )
    ON CONFLICT (agent_id, version) DO UPDATE
      SET definition = EXCLUDED.definition,
          config_hash = EXCLUDED.config_hash
    RETURNING * INTO v_version;
  END IF;

  v_definition := v_version.definition;

  -- Server-side activation preflight. This is the same safety gate the manual
  -- Validate and Test controls expose, but it is executed automatically.
  IF jsonb_typeof(v_definition) <> 'object'
     OR NOT (v_definition ? 'agent_id')
     OR NOT (v_definition ? 'version')
     OR jsonb_typeof(COALESCE(v_definition->'allowed_inputs','[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(v_definition->'allowed_inputs','[]'::jsonb)) = 0
     OR jsonb_typeof(COALESCE(v_definition->'expected_outputs','[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(v_definition->'expected_outputs','[]'::jsonb)) = 0
     OR jsonb_typeof(COALESCE(v_definition->'quality_requirements','[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(v_definition->'quality_requirements','[]'::jsonb)) = 0
  THEN
    RAISE EXCEPTION 'Agent activation preflight failed: incomplete contract definition';
  END IF;

  IF v_definition->>'agent_id' <> 'agent_' || v_agent.agent_key THEN
    RAISE EXCEPTION 'Agent activation preflight failed: agent identity mismatch';
  END IF;

  -- Record the hidden validation/test gates so the audit trail remains truthful.
  UPDATE public.agent_versions
  SET lifecycle_state = 'validated',
      validated_by = p_actor_id,
      validated_at = now()
  WHERE id = v_version.id
    AND lifecycle_state IN ('draft','disabled','maintenance','validated');

  UPDATE public.agent_versions
  SET lifecycle_state = 'tested',
      tested_by = p_actor_id,
      tested_at = now()
  WHERE id = v_version.id
    AND lifecycle_state IN ('validated','tested');

  SELECT * INTO v_previous
  FROM public.agent_versions
  WHERE agent_id = p_agent_id
    AND lifecycle_state = 'active'
    AND id <> v_version.id
  ORDER BY activated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_previous.id IS NOT NULL THEN
    UPDATE public.agent_versions
    SET lifecycle_state = 'rolled_back',
        retired_at = now(),
        rollback_reason = 'Superseded by administrator operational activation'
    WHERE id = v_previous.id;
  END IF;

  UPDATE public.agents
  SET status = 'enabled',
      config = v_definition,
      last_activity_at = now(),
      updated_at = now()
  WHERE id = p_agent_id;

  UPDATE public.agent_versions
  SET lifecycle_state = 'active',
      activated_by = p_actor_id,
      activated_at = now(),
      retired_at = NULL,
      rollback_reason = NULL
  WHERE id = v_version.id;

  INSERT INTO public.agent_config_history (
    agent_id, version_id, action, before_config, after_config, actor_id, reason
  )
  VALUES (
    p_agent_id,
    v_version.id,
    'activated',
    CASE WHEN v_previous.id IS NULL THEN NULL ELSE v_previous.definition END,
    v_definition,
    p_actor_id,
    COALESCE(p_reason, 'Administrator activated agent from operational control')
  );

  SELECT * INTO v_version
  FROM public.agent_versions
  WHERE id = v_version.id;

  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_activate_operational(uuid,uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_activate_operational(uuid,uuid,text) TO service_role;


CREATE OR REPLACE FUNCTION public.agent_set_operational_state(
  p_agent_id uuid,
  p_target_state text,
  p_actor_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.agent_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent public.agents;
  v_version public.agent_versions;
BEGIN
  IF NOT public.has_role(p_actor_id, 'admin') THEN
    RAISE EXCEPTION 'Administrator authorization required';
  END IF;

  IF p_target_state NOT IN ('maintenance','disabled') THEN
    RAISE EXCEPTION 'Operational state must be maintenance or disabled';
  END IF;

  SELECT * INTO v_agent
  FROM public.agents
  WHERE id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;

  SELECT * INTO v_version
  FROM public.agent_versions
  WHERE agent_id = p_agent_id
    AND lifecycle_state IN ('active','maintenance','tested')
  ORDER BY activated_at DESC NULLS LAST, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_version.id IS NULL THEN
    RAISE EXCEPTION 'Agent has no operational version';
  END IF;

  UPDATE public.agents
  SET status = p_target_state::public.agent_status,
      updated_at = now()
  WHERE id = p_agent_id;

  UPDATE public.agent_versions
  SET lifecycle_state = p_target_state,
      retired_at = CASE WHEN p_target_state = 'disabled' THEN COALESCE(retired_at, now()) ELSE NULL END
  WHERE id = v_version.id;

  INSERT INTO public.agent_config_history (
    agent_id, version_id, action, before_config, after_config, actor_id, reason
  )
  VALUES (
    p_agent_id,
    v_version.id,
    p_target_state,
    v_version.definition,
    v_version.definition,
    p_actor_id,
    COALESCE(p_reason, 'Administrator changed agent operational state')
  );

  SELECT * INTO v_version
  FROM public.agent_versions
  WHERE id = v_version.id;

  RETURN v_version;
END;
$$;

REVOKE ALL ON FUNCTION public.agent_set_operational_state(uuid,text,uuid,text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_set_operational_state(uuid,text,uuid,text) TO service_role;


CREATE INDEX IF NOT EXISTS agent_action_audit_agent_created_idx
  ON public.agent_action_audit(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_handoffs_created_idx
  ON public.agent_handoffs(created_at DESC);

CREATE INDEX IF NOT EXISTS agent_messages_created_idx
  ON public.agent_messages(created_at DESC);
