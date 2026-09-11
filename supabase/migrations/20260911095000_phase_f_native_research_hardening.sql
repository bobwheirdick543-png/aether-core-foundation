-- Phase F Native Research hardening.
-- This migration is additive: it preserves the existing research/runtime tables and
-- adds durable provenance, attempt history, plans, comparisons, and policy events.

ALTER TABLE public.aether_research_sessions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS freshness_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS research_plan jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.aether_research_sources
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_url text,
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS headings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS encoding text,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS content_length integer,
  ADD COLUMN IF NOT EXISTS redirect_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retrieval_attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stale_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS quality_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS quality_factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS robots_allowed boolean,
  ADD COLUMN IF NOT EXISTS retrieval_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS failure_class text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS version_id uuid;

CREATE TABLE IF NOT EXISTS public.aether_research_source_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.aether_research_sources(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number > 0),
  content_hash text NOT NULL,
  change_state text NOT NULL DEFAULT 'new' CHECK (change_state IN ('new','unchanged','changed')),
  content_length integer,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  parser_version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(source_id, version_number)
);

ALTER TABLE public.aether_research_sources
  DROP CONSTRAINT IF EXISTS aether_research_sources_version_id_fkey;
ALTER TABLE public.aether_research_sources
  ADD CONSTRAINT aether_research_sources_version_id_fkey
  FOREIGN KEY (version_id) REFERENCES public.aether_research_source_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.aether_research_retrieval_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.aether_research_sessions(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.aether_research_sources(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt integer NOT NULL CHECK (attempt > 0),
  status text NOT NULL CHECK (status IN ('started','retrieved','failed','blocked','deferred','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  http_status integer,
  failure_class text,
  error text,
  backoff_ms integer,
  worker text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.aether_research_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.aether_research_sessions(id) ON DELETE CASCADE,
  topic text NOT NULL,
  strategy text NOT NULL,
  queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  comparison_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  unmet_requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','running','completed','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aether_research_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.aether_research_sessions(id) ON DELETE CASCADE,
  subject text NOT NULL,
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  comparison jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aether_research_policy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.aether_research_sessions(id) ON DELETE SET NULL,
  domain text,
  event_type text NOT NULL CHECK (event_type IN ('rate_limited','deferred','robots_denied','blocked','technical_limit')),
  url text,
  retry_after_ms integer,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aether_research_source_versions_source_idx
  ON public.aether_research_source_versions(source_id, version_number DESC);
CREATE INDEX IF NOT EXISTS aether_research_source_versions_hash_idx
  ON public.aether_research_source_versions(content_hash);
CREATE INDEX IF NOT EXISTS aether_research_attempts_session_idx
  ON public.aether_research_retrieval_attempts(session_id, started_at DESC);
CREATE INDEX IF NOT EXISTS aether_research_attempts_source_idx
  ON public.aether_research_retrieval_attempts(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS aether_research_plans_owner_idx
  ON public.aether_research_plans(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aether_research_comparisons_owner_idx
  ON public.aether_research_comparisons(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aether_research_policy_events_domain_idx
  ON public.aether_research_policy_events(domain, created_at DESC);

ALTER TABLE public.aether_research_source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aether_research_retrieval_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aether_research_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aether_research_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aether_research_policy_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "research source versions owner read" ON public.aether_research_source_versions;
CREATE POLICY "research source versions owner read" ON public.aether_research_source_versions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "research source versions owner insert" ON public.aether_research_source_versions;
CREATE POLICY "research source versions owner insert" ON public.aether_research_source_versions
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "research attempts owner read" ON public.aether_research_retrieval_attempts;
CREATE POLICY "research attempts owner read" ON public.aether_research_retrieval_attempts
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "research attempts owner insert" ON public.aether_research_retrieval_attempts;
CREATE POLICY "research attempts owner insert" ON public.aether_research_retrieval_attempts
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "research plans owner read" ON public.aether_research_plans;
CREATE POLICY "research plans owner read" ON public.aether_research_plans
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "research plans owner insert" ON public.aether_research_plans;
CREATE POLICY "research plans owner insert" ON public.aether_research_plans
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "research comparisons owner read" ON public.aether_research_comparisons;
CREATE POLICY "research comparisons owner read" ON public.aether_research_comparisons
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "research comparisons owner insert" ON public.aether_research_comparisons;
CREATE POLICY "research comparisons owner insert" ON public.aether_research_comparisons
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "research policy events owner read" ON public.aether_research_policy_events;
CREATE POLICY "research policy events owner read" ON public.aether_research_policy_events
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL);
DROP POLICY IF EXISTS "research policy events owner insert" ON public.aether_research_policy_events;
CREATE POLICY "research policy events owner insert" ON public.aether_research_policy_events
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_research_plan_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS aether_research_plans_updated ON public.aether_research_plans;
CREATE TRIGGER aether_research_plans_updated BEFORE UPDATE ON public.aether_research_plans
FOR EACH ROW EXECUTE FUNCTION public.set_research_plan_updated_at();
DROP TRIGGER IF EXISTS aether_research_comparisons_updated ON public.aether_research_comparisons;
CREATE TRIGGER aether_research_comparisons_updated BEFORE UPDATE ON public.aether_research_comparisons
FOR EACH ROW EXECUTE FUNCTION public.set_research_plan_updated_at();
