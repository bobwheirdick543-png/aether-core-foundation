-- AETHER PHASE B: universal conversational orchestrator foundation.
-- Plans, steps, decisions, trace events, agent-local conversations and
-- measurable productivity telemetry. No model/provider is hard-coded here.

CREATE TABLE IF NOT EXISTS public.orchestration_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  intent text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  agents jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  approval_required boolean NOT NULL DEFAULT false,
  approval_status text NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required','pending','approved','rejected')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','awaiting_approval','executing','paused','completed','failed','cancelled','superseded')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  supersedes_plan_id uuid REFERENCES public.orchestration_plans(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS orchestration_plans_owner_idx ON public.orchestration_plans(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orchestration_plans_task_idx ON public.orchestration_plans(task_id, version DESC);
ALTER TABLE public.orchestration_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.orchestration_plans TO authenticated;
GRANT ALL ON public.orchestration_plans TO service_role;
DROP POLICY IF EXISTS "own orchestration plans" ON public.orchestration_plans;
CREATE POLICY "own orchestration plans" ON public.orchestration_plans FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.orchestration_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.orchestration_plans(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  sequence integer NOT NULL,
  step_key text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  description text,
  dependencies uuid[] NOT NULL DEFAULT '{}',
  agent_key text,
  model_role text,
  required_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low','medium','high','critical')),
  approval_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','running','waiting_approval','completed','failed','skipped','cancelled')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  UNIQUE(plan_id, sequence),
  UNIQUE(plan_id, step_key)
);
CREATE INDEX IF NOT EXISTS orchestration_steps_plan_idx ON public.orchestration_steps(plan_id, sequence);
ALTER TABLE public.orchestration_steps ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.orchestration_steps TO authenticated;
GRANT ALL ON public.orchestration_steps TO service_role;
DROP POLICY IF EXISTS "own orchestration steps" ON public.orchestration_steps;
CREATE POLICY "own orchestration steps" ON public.orchestration_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orchestration_plans p WHERE p.id = orchestration_steps.plan_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE IF NOT EXISTS public.orchestration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.orchestration_plans(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  step_id uuid REFERENCES public.orchestration_steps(id) ON DELETE SET NULL,
  sequence bigint NOT NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('user','orchestrator','agent','model','tool','system','admin')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text,
  reason text,
  decision text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, sequence)
);
CREATE INDEX IF NOT EXISTS orchestration_events_plan_idx ON public.orchestration_events(plan_id, sequence);
CREATE INDEX IF NOT EXISTS orchestration_events_task_idx ON public.orchestration_events(task_id, created_at DESC);
ALTER TABLE public.orchestration_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.orchestration_events TO authenticated;
GRANT ALL ON public.orchestration_events TO service_role;
DROP POLICY IF EXISTS "own orchestration events" ON public.orchestration_events;
CREATE POLICY "own orchestration events" ON public.orchestration_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orchestration_plans p WHERE p.id = orchestration_events.plan_id AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE IF NOT EXISTS public.orchestrator_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','active','rolled_back','disabled')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  rolled_back_at timestamptz,
  rolled_back_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.orchestrator_configs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.orchestrator_configs TO authenticated;
GRANT ALL ON public.orchestrator_configs TO service_role;
DROP POLICY IF EXISTS "admin orchestrator configs" ON public.orchestrator_configs;
CREATE POLICY "admin orchestrator configs" ON public.orchestrator_configs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_key text NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  archived boolean NOT NULL DEFAULT false,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_conversations_owner_agent_idx ON public.agent_conversations(owner_id, agent_key, updated_at DESC);
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_conversations TO authenticated;
GRANT ALL ON public.agent_conversations TO service_role;
DROP POLICY IF EXISTS "own agent conversations" ON public.agent_conversations;
CREATE POLICY "own agent conversations" ON public.agent_conversations FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.agent_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','event')),
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_messages_conversation_idx ON public.agent_conversation_messages(conversation_id, created_at);
ALTER TABLE public.agent_conversation_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.agent_conversation_messages TO authenticated;
GRANT ALL ON public.agent_conversation_messages TO service_role;
DROP POLICY IF EXISTS "own agent messages" ON public.agent_conversation_messages;
CREATE POLICY "own agent messages" ON public.agent_conversation_messages FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "insert own agent messages" ON public.agent_conversation_messages FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.agent_learning_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL,
  source_agent_key text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('conversation','research','verification','task','knowledge')),
  source_id uuid,
  candidate jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','verified','approved','rejected','outdated')),
  confidence numeric(5,4) CHECK (confidence >= 0 AND confidence <= 1),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_learning_agent_status_idx ON public.agent_learning_records(agent_key, status, created_at DESC);
ALTER TABLE public.agent_learning_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.agent_learning_records TO authenticated;
GRANT ALL ON public.agent_learning_records TO service_role;
DROP POLICY IF EXISTS "own agent learning" ON public.agent_learning_records;
CREATE POLICY "own agent learning" ON public.agent_learning_records FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR status = 'approved');

CREATE TABLE IF NOT EXISTS public.agent_productivity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_key text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  productivity_percent numeric(5,2) NOT NULL CHECK (productivity_percent >= 0 AND productivity_percent <= 100),
  completed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  retried_count integer NOT NULL DEFAULT 0,
  evaluated_count integer NOT NULL DEFAULT 0,
  source_run_count integer NOT NULL DEFAULT 0,
  calculation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(agent_key, window_start, window_end)
);
CREATE INDEX IF NOT EXISTS agent_productivity_latest_idx ON public.agent_productivity_metrics(agent_key, window_end DESC);
ALTER TABLE public.agent_productivity_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.agent_productivity_metrics TO authenticated;
GRANT ALL ON public.agent_productivity_metrics TO service_role;
DROP POLICY IF EXISTS "agent productivity visible" ON public.agent_productivity_metrics;
CREATE POLICY "agent productivity visible" ON public.agent_productivity_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.model_productivity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_role text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  productivity_percent numeric(5,2) NOT NULL CHECK (productivity_percent >= 0 AND productivity_percent <= 100),
  request_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  retried_count integer NOT NULL DEFAULT 0,
  evaluated_count integer NOT NULL DEFAULT 0,
  calculation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(model_role, window_start, window_end)
);
CREATE INDEX IF NOT EXISTS model_productivity_latest_idx ON public.model_productivity_metrics(model_role, window_end DESC);
ALTER TABLE public.model_productivity_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.model_productivity_metrics TO authenticated;
GRANT ALL ON public.model_productivity_metrics TO service_role;
DROP POLICY IF EXISTS "model productivity admin" ON public.model_productivity_metrics;
CREATE POLICY "model productivity admin" ON public.model_productivity_metrics FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.append_orchestration_event(
  p_plan_id uuid,
  p_event_type text,
  p_actor_type text,
  p_actor_id uuid DEFAULT NULL,
  p_task_id uuid DEFAULT NULL,
  p_run_id uuid DEFAULT NULL,
  p_step_id uuid DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_decision text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
) RETURNS public.orchestration_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event public.orchestration_events; v_sequence bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_plan_id::text, 0));
  SELECT COALESCE(MAX(sequence), 0) + 1 INTO v_sequence FROM public.orchestration_events WHERE plan_id = p_plan_id;
  INSERT INTO public.orchestration_events(plan_id, task_id, run_id, step_id, sequence, event_type, actor_type, actor_id, action, reason, decision, data)
  VALUES(p_plan_id,p_task_id,p_run_id,p_step_id,v_sequence,p_event_type,p_actor_type,p_actor_id,p_action,p_reason,p_decision,COALESCE(p_data,'{}'::jsonb))
  RETURNING * INTO v_event;
  RETURN v_event;
END;
$$;
GRANT EXECUTE ON FUNCTION public.append_orchestration_event(uuid,text,text,uuid,uuid,uuid,uuid,text,text,text,jsonb) TO service_role;

-- A baseline configuration is intentionally explicit and inert until activated.
INSERT INTO public.orchestrator_configs(version, status, config, change_note)
VALUES (1, 'validated', jsonb_build_object(
  'intentConfidenceThreshold', 0.75,
  'requireClarificationBelow', 0.55,
  'contextBudgetPolicy', 'relevance_first',
  'defaultRiskLevel', 'low',
  'showPlanPreviewForRisk', 'high',
  'userProgressEnabled', true,
  'traceAllActions', true
), 'Initial Phase B orchestrator policy baseline')
ON CONFLICT (version) DO NOTHING;
