-- Restore exactly one optimized owner policy per Phase F table after duplicate cleanup.
CREATE POLICY "phase f source versions owner read" ON public.aether_research_source_versions FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
CREATE POLICY "phase f source versions owner insert" ON public.aether_research_source_versions FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY "phase f attempts owner read" ON public.aether_research_retrieval_attempts FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
CREATE POLICY "phase f attempts owner insert" ON public.aether_research_retrieval_attempts FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY "phase f plans owner read" ON public.aether_research_plans FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
CREATE POLICY "phase f plans owner insert" ON public.aether_research_plans FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY "phase f comparisons owner read" ON public.aether_research_comparisons FOR SELECT TO authenticated USING (owner_id = (select auth.uid()));
CREATE POLICY "phase f comparisons owner insert" ON public.aether_research_comparisons FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
CREATE POLICY "phase f policy events owner read" ON public.aether_research_policy_events FOR SELECT TO authenticated USING (owner_id = (select auth.uid()) OR owner_id IS NULL);
CREATE POLICY "phase f policy events owner insert" ON public.aether_research_policy_events FOR INSERT TO authenticated WITH CHECK (owner_id = (select auth.uid()));
