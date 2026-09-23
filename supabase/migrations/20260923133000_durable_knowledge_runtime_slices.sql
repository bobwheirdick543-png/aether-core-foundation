-- Durable knowledge acquisition worker continuation and targeted dispatch.
-- Keeps the task in running state between bounded research slices while allowing
-- each persisted run to be independently leased and resumed.

CREATE OR REPLACE FUNCTION public.claim_next_runtime_run(p_worker_id text, p_lease_seconds integer DEFAULT 60)
RETURNS TABLE(task_id uuid,run_id uuid,owner_id uuid,project_id uuid,task_status task_status,run_status task_status,attempt integer,task_kind text,task_detail jsonb,inputs jsonb,timeout_ms bigint,deadline_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_run public.task_runs;
  v_task public.tasks;
  v_now timestamptz:=now();
  v_lease timestamptz:=v_now+make_interval(secs=>GREATEST(p_lease_seconds,10));
  v_platform_limit integer; v_user_limit integer; v_project_limit integer;
  v_platform_running integer; v_user_running integer; v_project_running integer;
BEGIN
  SELECT rq.max_concurrent INTO v_platform_limit FROM public.runtime_quotas rq WHERE rq.scope_type='platform' AND rq.scope_id IS NULL;
  SELECT count(*) INTO v_platform_running FROM public.task_runs tr WHERE tr.status='running' AND tr.lease_expires_at>v_now;
  IF v_platform_limit IS NOT NULL AND v_platform_running>=v_platform_limit THEN RETURN; END IF;
  SELECT tr.* INTO v_run
  FROM public.task_runs tr JOIN public.tasks t ON t.id=tr.task_id
  WHERE tr.status IN ('queued','retrying') AND t.status IN ('queued','retrying','running')
    AND tr.cancel_requested_at IS NULL AND t.cancel_requested_at IS NULL
    AND (tr.next_attempt_at IS NULL OR tr.next_attempt_at<=v_now) AND (t.next_attempt_at IS NULL OR t.next_attempt_at<=v_now)
    AND (tr.deadline_at IS NULL OR tr.deadline_at>v_now) AND (t.deadline_at IS NULL OR t.deadline_at>v_now)
    AND NOT EXISTS (SELECT 1 FROM public.task_runs active WHERE active.task_id=t.id AND active.status='running' AND active.lease_expires_at>v_now)
  ORDER BY t.priority DESC,COALESCE(tr.next_attempt_at,t.next_attempt_at,t.created_at),tr.created_at
  FOR UPDATE OF tr SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT t.* INTO v_task FROM public.tasks t WHERE t.id=v_run.task_id FOR UPDATE;
  SELECT rq.max_concurrent INTO v_user_limit FROM public.runtime_quotas rq WHERE rq.scope_type='user' AND rq.scope_id=v_task.user_id;
  SELECT rq.max_concurrent INTO v_project_limit FROM public.runtime_quotas rq WHERE rq.scope_type='project' AND rq.scope_id=v_task.project_id;
  SELECT count(*) INTO v_user_running FROM public.task_runs tr WHERE tr.owner_id=v_task.user_id AND tr.status='running' AND tr.lease_expires_at>v_now;
  IF v_user_limit IS NOT NULL AND v_user_running>=v_user_limit THEN RETURN; END IF;
  IF v_task.project_id IS NOT NULL THEN
    SELECT count(*) INTO v_project_running FROM public.task_runs tr JOIN public.tasks t ON t.id=tr.task_id WHERE t.project_id=v_task.project_id AND tr.status='running' AND tr.lease_expires_at>v_now;
    IF v_project_limit IS NOT NULL AND v_project_running>=v_project_limit THEN RETURN; END IF;
  END IF;
  UPDATE public.task_runs SET status='running',worker_id=p_worker_id,lease_expires_at=v_lease,heartbeat_at=v_now,started_at=COALESCE(started_at,v_now),updated_at=v_now WHERE id=v_run.id;
  UPDATE public.tasks SET status='running',worker_id=p_worker_id,lease_expires_at=v_lease,heartbeat_at=v_now,started_at=COALESCE(started_at,v_now),updated_at=v_now WHERE id=v_task.id;
  INSERT INTO public.runtime_workers(worker_id,status,current_run_id,last_heartbeat_at) VALUES(p_worker_id,'running',v_run.id,v_now)
  ON CONFLICT(worker_id) DO UPDATE SET status='running',current_run_id=v_run.id,last_heartbeat_at=v_now,updated_at=v_now;
  PERFORM public.append_task_event(v_task.id,v_run.id,'run.claimed','queued','running','Runtime worker claimed execution',jsonb_build_object('attempt',v_run.attempt),NULL,p_worker_id);
  RETURN QUERY SELECT v_task.id,v_run.id,v_task.user_id,v_task.project_id,v_task.status,(SELECT tr.status FROM public.task_runs tr WHERE tr.id=v_run.id),v_run.attempt,v_task.kind,v_task.detail,v_run.inputs,LEAST(v_task.timeout_ms,v_run.timeout_ms),CASE WHEN v_task.deadline_at IS NULL THEN v_run.deadline_at WHEN v_run.deadline_at IS NULL THEN v_task.deadline_at ELSE LEAST(v_task.deadline_at,v_run.deadline_at) END;
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_specific_runtime_run(p_task_id uuid,p_actor_id uuid,p_worker_id text,p_lease_seconds integer DEFAULT 60)
RETURNS TABLE(task_id uuid,run_id uuid,owner_id uuid,project_id uuid,task_status task_status,run_status task_status,attempt integer,task_kind text,task_detail jsonb,inputs jsonb,timeout_ms bigint,deadline_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_run public.task_runs; v_task public.tasks; v_now timestamptz:=now(); v_lease timestamptz:=v_now+make_interval(secs=>GREATEST(p_lease_seconds,10)); v_is_admin boolean;
BEGIN
  SELECT t.* INTO v_task FROM public.tasks t WHERE t.id=p_task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=p_actor_id AND ur.role='admin') INTO v_is_admin;
  IF v_task.user_id<>p_actor_id AND NOT v_is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_task.status NOT IN ('queued','retrying','running') OR v_task.cancel_requested_at IS NOT NULL THEN RETURN; END IF;
  SELECT tr.* INTO v_run FROM public.task_runs tr WHERE tr.task_id=p_task_id AND tr.status IN ('queued','retrying') AND tr.cancel_requested_at IS NULL AND (tr.next_attempt_at IS NULL OR tr.next_attempt_at<=v_now) AND (tr.deadline_at IS NULL OR tr.deadline_at>v_now) ORDER BY tr.attempt DESC FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM public.task_runs active WHERE active.task_id=p_task_id AND active.status='running' AND active.lease_expires_at>v_now) THEN RETURN; END IF;
  UPDATE public.task_runs SET status='running',worker_id=p_worker_id,lease_expires_at=v_lease,heartbeat_at=v_now,started_at=COALESCE(started_at,v_now),updated_at=v_now WHERE id=v_run.id;
  UPDATE public.tasks SET status='running',worker_id=p_worker_id,lease_expires_at=v_lease,heartbeat_at=v_now,started_at=COALESCE(started_at,v_now),updated_at=v_now WHERE id=v_task.id;
  INSERT INTO public.runtime_workers(worker_id,status,current_run_id,last_heartbeat_at) VALUES(p_worker_id,'running',v_run.id,v_now)
  ON CONFLICT(worker_id) DO UPDATE SET status='running',current_run_id=v_run.id,last_heartbeat_at=v_now,updated_at=v_now;
  PERFORM public.append_task_event(v_task.id,v_run.id,'run.claimed','queued','running','Targeted runtime worker claimed execution',jsonb_build_object('attempt',v_run.attempt,'targeted',true),p_actor_id,p_worker_id);
  RETURN QUERY SELECT v_task.id,v_run.id,v_task.user_id,v_task.project_id,v_task.status,(SELECT tr.status FROM public.task_runs tr WHERE tr.id=v_run.id),v_run.attempt,v_task.kind,v_task.detail,v_run.inputs,LEAST(v_task.timeout_ms,v_run.timeout_ms),CASE WHEN v_task.deadline_at IS NULL THEN v_run.deadline_at WHEN v_run.deadline_at IS NULL THEN v_task.deadline_at ELSE LEAST(v_task.deadline_at,v_run.deadline_at) END;
END; $function$;