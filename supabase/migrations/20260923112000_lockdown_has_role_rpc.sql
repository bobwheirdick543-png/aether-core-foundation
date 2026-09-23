-- has_role is a server-side authorization helper, not a public RPC surface.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
