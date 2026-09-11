-- AETHER PHASE M: durable agent configuration/runtime governance.
-- Agents remain server-governed; client state is never authoritative.

CREATE TABLE IF NOT EXISTS public.agent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version text NOT NULL,
  lifecycle text NOT NULL CHECK (lifecycle IN ('draft','validated','tested','active','disabled','maintenance')),
  configuration jsonb NOT NULL,
  configuration_hash text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at timestamptz,
  tested_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, version)
);
CREATE INDEX IF NOT EXISTS agent_versions_agent_lifecycle_idx ON public.agent_versions(agent_id, lifecycle, created_at DESC);
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.agent_versions TO authenticated;
GRANT ALL ON public.agent_versions TO service_role;
DROP POLICY IF EXISTS "agent versions admin read" ON public.agent_versions;
CREATE POLICY "agent versions admin read" ON public.agent_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER agent_versions_updated BEFORE UPDATE ON public.agent_versions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE CASCADE,
  from_agent text NOT NULL,
  to_agent text NOT NULL,
  message_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_agent <> to_agent)
);
CREATE INDEX IF NOT EXISTS agent_messages_run_created_idx ON public.agent_messages(run_id, created_at);
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;
DROP POLICY IF EXISTS "agent messages owner read" ON public.agent_messages;
CREATE POLICY "agent messages owner read" ON public.agent_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = agent_messages.task_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);

CREATE OR REPLACE FUNCTION public.agent_transition_allowed(p_from text, p_to text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_from
    WHEN 'draft' THEN p_to IN ('validated','disabled')
    WHEN 'validated' THEN p_to IN ('tested','draft','disabled')
    WHEN 'tested' THEN p_to IN ('active','draft','disabled')
    WHEN 'active' THEN p_to IN ('maintenance','disabled')
    WHEN 'disabled' THEN p_to IN ('draft','validated')
    WHEN 'maintenance' THEN p_to IN ('active','disabled')
    ELSE false
  END;
$$;
GRANT EXECUTE ON FUNCTION public.agent_transition_allowed(text,text) TO authenticated, service_role;

-- Persist the current SDK contract for each known agent without activating disabled agents.
INSERT INTO public.agent_versions (agent_id, version, lifecycle, configuration, configuration_hash)
SELECT a.id, '1.0.0', CASE WHEN a.status = 'enabled' THEN 'active' ELSE a.status::text END,
       jsonb_build_object('agent_key',a.agent_key,'name',a.name,'description',a.description,'purpose',a.purpose,'tools',a.tools,'status',a.status::text),
       md5(jsonb_build_object('agent_key',a.agent_key,'name',a.name,'description',a.description,'purpose',a.purpose,'tools',a.tools,'status',a.status::text)::text)
FROM public.agents a
ON CONFLICT (agent_id, version) DO NOTHING;
