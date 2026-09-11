-- The immutable discovery trigger is an internal trigger function, not an RPC.
REVOKE ALL ON FUNCTION public.prevent_research_discovery_event_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_research_discovery_event_mutation() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_research_discovery_event_mutation() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_research_discovery_event_mutation() TO service_role;
