-- Remove duplicate Phase F policies/indexes introduced while reconciling pre-existing tables.
DROP POLICY IF EXISTS "aether research plans owner read" ON public.aether_research_plans;
DROP POLICY IF EXISTS "aether research plans owner insert" ON public.aether_research_plans;
DROP POLICY IF EXISTS "aether research comparisons owner read" ON public.aether_research_comparisons;
DROP POLICY IF EXISTS "aether research comparisons owner insert" ON public.aether_research_comparisons;
DROP INDEX IF EXISTS public.aether_research_comparisons_session_idx2;
CREATE INDEX IF NOT EXISTS aether_research_retrieval_attempts_owner_idx ON public.aether_research_retrieval_attempts(owner_id, started_at DESC);
