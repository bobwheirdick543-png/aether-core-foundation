-- AETHER: fix operational state enum casting for agent status transitions.
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
      retired_at = CASE
        WHEN p_target_state = 'disabled' THEN COALESCE(retired_at, now())
        ELSE NULL
      END
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
