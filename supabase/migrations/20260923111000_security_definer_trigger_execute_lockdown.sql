-- Trigger-only SECURITY DEFINER functions must not be callable through PostgREST.
REVOKE EXECUTE ON FUNCTION public.sync_knowledge_acquisition_job_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_platform_knowledge_publication() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_signup_location_to_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_task_owner_identity() FROM PUBLIC, anon, authenticated;
