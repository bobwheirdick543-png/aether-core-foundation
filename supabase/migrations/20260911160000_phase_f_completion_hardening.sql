-- Phase F completion hardening.
-- Additive only: preserves existing Phase D/F tables and makes provenance,
-- historical change detection, discovery tracking, and project isolation explicit.

ALTER TABLE public.aether_research_sources
  ADD COLUMN IF NOT EXISTS stale_reason text,
  ADD COLUMN IF NOT EXISTS redirect_chain jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS change_state text;

ALTER TABLE public.aether_research_source_versions
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.aether_research_retrieval_attempts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.aether_research_policy_events
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.aether_research_discovery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.aether_research_sessions(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  sequence integer NOT NULL CHECK (sequence > 0),
  provider text NOT NULL,
  query text NOT NULL,
  status text NOT NULL CHECK (status IN ('started','completed','failed','cancelled')),
  result_count integer NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, sequence)
);

CREATE INDEX IF NOT EXISTS aether_research_discovery_owner_idx
  ON public.aether_research_discovery_events(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aether_research_discovery_session_idx
  ON public.aether_research_discovery_events(session_id, sequence);
CREATE INDEX IF NOT EXISTS aether_research_policy_project_idx
  ON public.aether_research_policy_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aether_research_versions_project_idx
  ON public.aether_research_source_versions(project_id, retrieved_at DESC);

ALTER TABLE public.aether_research_discovery_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "research discovery owner read" ON public.aether_research_discovery_events;
CREATE POLICY "research discovery owner read" ON public.aether_research_discovery_events
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
DROP POLICY IF EXISTS "research discovery owner insert" ON public.aether_research_discovery_events;
CREATE POLICY "research discovery owner insert" ON public.aether_research_discovery_events
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- Service-role writes remain available for the durable worker; authenticated
-- users can only see their own project/user records through owner-scoped RLS.
