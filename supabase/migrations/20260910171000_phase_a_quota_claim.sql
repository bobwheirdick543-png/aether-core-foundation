-- Phase A follow-up: enforce platform/user/project concurrency quotas at claim time.
CREATE OR REPLACE FUNCTION public.claim_next_runtime_run(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 60
)
RETURNS TABLE (
  task_id uuid, run_id uuid, owner_id uuid, project_id uuid,
  task_status public.task_status, run_status public.task_status, attempt integer,
  task_kind text, task_detail jsonb, inputs jsonb, timeout_ms bigint, deadline_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run public.task_runs; v_task public.tasks; v_now timestamptz := now();
  v_lease timestamptz := v_now + make_interval(secs => GREATEST(p_lease_seconds, 10));
  v_platform_limit integer; v_user_limit integer; v_project_limit integer;
  v_platform_running integer; v_user_running integer; v_project_running integer;
BEGIN
  SELECT max_concurrent INTO v_platform_limit FROM public.runtime_quotas WHERE scope_type='platform' AND scope_id IS NULL;
  SELECT count(*) INTO v_platform_running FROM public.task_runs WHERE status='running' AND lease_expires_at > v_now;
  IF v_platform_limit IS NOT NULL AND v_platform_running >= v_platform_limit THEN RETURN; END IF;
  SELECT r.* INTO v_run FROM public.task_runs r JOIN public.tasks t ON t.id=r.task_id
  WHERE r.status IN ('queued','retrying') AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= v_now)
    AND t.status IN ('queued','retrying') AND (t.next_attempt_at IS NULL OR t.next_attempt_at <= v_now)
    AND (r.deadline_at IS NULL OR r.deadline_at > v_now) AND (t.deadline_at IS NULL OR t.deadline_at > v_now)
  ORDER BY t.priority DESC, COALESCE(r.next_attempt_at,t.next_attempt_at,t.created_at), r.created_at
  FOR UPDATE OF r SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_task FROM public.tasks WHERE id=v_run.task_id FOR UPDATE;
  SELECT max_concurrent INTO v_user_limit FROM public.runtime_quotas WHERE scope_type='user' AND scope_id=v_task.user_id;
  SELECT max_concurrent INTO v_project_limit FROM public.runtime_quotas WHERE scope_type='project' AND scope_id=v_task.project_id;
  SELECT count(*) INTO v_user_running FROM public.task_runs WHERE owner_id=v_task.user_id AND status='running' AND lease_expires_at > v_now;
  IF v_user_limit IS NOT NULL AND v_user_running >= v_user_limit THEN RETURN; END IF;
  IF v_task.project_id IS NOT NULL THEN
    SELECT count(*) INTO v_project_running FROM public.task_runs tr JOIN public.tasks t ON t.id=tr.task_id WHERE t.project_id=v_task.project_id AND tr.status='running' AND tr.lease_expires_at > v_now;
    IF v_project_limit IS NOT NULL AND v_project_running >= v_project_limit THEN RETURN; END IF;
  END IF;
  UPDATE public.task_runs SET status='running',worker_id=p_worker_id,lease_expires_at=v_lease,heartbeat_at=v_now,started_at=COALESCE(started_at,v_now),updated_at=v_now WHERE id=v_run.id;
  UPDATE public.tasks SET status='running',worker_id=p_worker_id,lease_expires_at=v_lease,heartbeat_at=v_now,started_at=COALESCE(started_at,v_now),updated_at=v_now WHERE id=v_task.id;
  INSERT INTO public.runtime_workers(worker_id,status,current_run_id,last_heartbeat_at) VALUES(p_worker_id,'running',v_run.id,v_now)
    ON CONFLICT(worker_id) DO UPDATE SET status='running',current_run_id=v_run.id,last_heartbeat_at=v_now,updated_at=v_now;
  PERFORM public.append_task_event(v_task.id,v_run.id,'run.claimed','queued','running','Runtime worker claimed execution',jsonb_build_object('attempt',v_run.attempt),NULL,p_worker_id);
  RETURN QUERY SELECT v_task.id,v_run.id,v_task.user_id,v_task.project_id,v_task.status,(SELECT status FROM public.task_runs WHERE id=v_run.id),v_run.attempt,v_task.kind,v_task.detail,v_run.inputs,LEAST(v_task.timeout_ms,v_run.timeout_ms),CASE WHEN v_task.deadline_at IS NULL THEN v_run.deadline_at WHEN v_run.deadline_at IS NULL THEN v_task.deadline_at ELSE LEAST(v_task.deadline_at,v_run.deadline_at) END;
END;
$$;
