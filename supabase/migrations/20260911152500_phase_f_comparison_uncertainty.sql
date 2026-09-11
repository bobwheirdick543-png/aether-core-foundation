-- Phase F F9: comparison output must preserve uncertainty and missing evidence
-- as first-class persisted state. Comparison is not verification.

ALTER TABLE public.aether_research_comparisons
  ADD COLUMN IF NOT EXISTS missing_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS uncertainty jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS aether_research_comparisons_session_idx
  ON public.aether_research_comparisons(session_id, created_at DESC);
