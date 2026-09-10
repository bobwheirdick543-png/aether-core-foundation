-- Runtime queue functions are backend-only primitives. Never expose them through
-- the public PostgREST RPC surface to anonymous or authenticated clients.
REVOKE EXECUTE ON FUNCTION public.append_task_event(uuid, uuid, text, public.task_status, public.task_status, text, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_task_event(uuid, uuid, text, public.task_status, public.task_status, text, jsonb, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.claim_next_runtime_run(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_runtime_run(text, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.requeue_expired_runtime_work(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_expired_runtime_work(integer) TO service_role;
