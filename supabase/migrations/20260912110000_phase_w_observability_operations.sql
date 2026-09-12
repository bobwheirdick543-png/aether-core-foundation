-- AETHER PHASE W: global, durable observability primitives.
-- These tables record real execution telemetry; they do not generate synthetic activity.

CREATE TABLE IF NOT EXISTS public.aether_observability_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK (level IN ('debug','info','warn','error')),
  component text NOT NULL,
  event_type text NOT NULL,
  message text,
  trace_id text,
  request_id text,
  span_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  worker_id text,
  agent_key text,
  model_id text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  success boolean,
  retryable boolean,
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aether_obs_events_time_idx ON public.aether_observability_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS aether_obs_events_trace_idx ON public.aether_observability_events (trace_id, occurred_at);
CREATE INDEX IF NOT EXISTS aether_obs_events_request_idx ON public.aether_observability_events (request_id, occurred_at);
CREATE INDEX IF NOT EXISTS aether_obs_events_task_idx ON public.aether_observability_events (task_id, occurred_at);
CREATE INDEX IF NOT EXISTS aether_obs_events_component_idx ON public.aether_observability_events (component, occurred_at);

CREATE TABLE IF NOT EXISTS public.aether_observability_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id text NOT NULL,
  span_id text NOT NULL UNIQUE,
  parent_span_id text,
  name text NOT NULL,
  component text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  worker_id text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aether_obs_spans_trace_idx ON public.aether_observability_spans (trace_id, started_at);
CREATE INDEX IF NOT EXISTS aether_obs_spans_component_idx ON public.aether_observability_spans (component, started_at);

CREATE TABLE IF NOT EXISTS public.aether_observability_metric_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  value double precision NOT NULL,
  unit text NOT NULL DEFAULT 'count',
  sampled_at timestamptz NOT NULL DEFAULT now(),
  component text NOT NULL,
  trace_id text,
  request_id text,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aether_obs_metrics_time_idx ON public.aether_observability_metric_samples (sampled_at DESC);
CREATE INDEX IF NOT EXISTS aether_obs_metrics_name_idx ON public.aether_observability_metric_samples (metric_name, sampled_at DESC);

ALTER TABLE public.aether_observability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aether_observability_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aether_observability_metric_samples ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.aether_observability_events TO authenticated;
GRANT SELECT ON public.aether_observability_spans TO authenticated;
GRANT SELECT ON public.aether_observability_metric_samples TO authenticated;
GRANT ALL ON public.aether_observability_events TO service_role;
GRANT ALL ON public.aether_observability_spans TO service_role;
GRANT ALL ON public.aether_observability_metric_samples TO service_role;

DROP POLICY IF EXISTS "observability events admin read" ON public.aether_observability_events;
CREATE POLICY "observability events admin read" ON public.aether_observability_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "observability spans admin read" ON public.aether_observability_spans;
CREATE POLICY "observability spans admin read" ON public.aether_observability_spans
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "observability metrics admin read" ON public.aether_observability_metric_samples;
CREATE POLICY "observability metrics admin read" ON public.aether_observability_metric_samples
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
