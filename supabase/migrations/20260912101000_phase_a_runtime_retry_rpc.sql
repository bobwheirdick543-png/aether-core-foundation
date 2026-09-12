-- Phase A hardening: durable runtime failures may schedule a new immutable run
-- without overwriting the failed attempt. This is callable only by the worker's
-- service-role runtime boundary.
CREATE OR REPLACE FUNCTION public.schedule_runtime_retry(
  p_task_id uuid,
  p_run_id uuid,
  p_reason text DEFAULT NULL,
  p_delay_seconds integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run public.task_runs;
  v_task public.tasks;
  v_delay integer;
  v_next_attempt integer;
  v_new_run_id uuid;
  v_reason text;
BEGIN
  SELECT * INTO v_run
  FROM public.task_runs
  WHERE id = p_run_id AND task_id = p_task_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Runtime run not found';
  END IF;

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Runtime task not found';
  END IF;

  IF v_run.status <> 'failed' OR COALESCE(v_run.retryable, false) IS NOT TRUE THEN
    RETURN NULL;
  END IF;

  IF COALESCE(v_run.retry_count, 0) >= COALESCE(v_run.max_retries, 3) THEN
    UPDATE public.tasks
    SET status = 'failed', completed_at = COALESCE(completed_at, now()),
        dead_lettered_at = COALESCE(dead_lettered_at, now()),
        updated_at = now()
    WHERE id = p_task_id;

    INSERT INTO public.task_dead_letters
      (task_id, run_id, owner_id, reason, failure_code, error_message, payload)
    VALUES
      (p_task_id, p_run_id, v_run.owner_id, 'retry_budget_exhausted',
       v_run.failure_code, COALESCE(v_run.error, p_reason, 'Retry budget exhausted'),
       '{}'::jsonb)
    ON CONFLICT (run_id) DO NOTHING;
    RETURN NULL;
  END IF;

  v_delay := LEAST(
    300,
    GREATEST(
      1,
      COALESCE(p_delay_seconds, (2 ^ LEAST(COALESCE(v_run.retry_count, 0), 6)) * 5)
    )
  );
  v_next_attempt := COALESCE(v_run.attempt, 1) + 1;
  v_reason := COALESCE(NULLIF(trim(p_reason), ''), v_run.error, 'Runtime execution failed; retry scheduled');

  UPDATE public.tasks
  SET status = 'retrying',
      retry_count = retry_count + 1,
      next_attempt_at = now() + make_interval(secs => v_delay),
      worker_id = NULL,
      lease_expires_at = NULL,
      heartbeat_at = NULL,
      completed_at = NULL,
      dead_lettered_at = NULL,
      last_error_code = COALESCE(v_run.failure_code, 'runtime_execution_error'),
      last_error_message = v_reason,
      updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.task_runs
    (task_id, owner_id, agent_id, agent_key, attempt, status, inputs, outputs,
     retry_of, timeout_ms, deadline_at, max_retries, retry_count, next_attempt_at)
  VALUES
    (p_task_id, v_run.owner_id, v_run.agent_id, v_run.agent_key, v_next_attempt,
     'retrying', COALESCE(v_run.inputs, '{}'::jsonb), '{}'::jsonb, p_run_id,
     v_run.timeout_ms, v_run.deadline_at, v_run.max_retries, 0,
     now() + make_interval(secs => v_delay))
  RETURNING id INTO v_new_run_id;

  PERFORM public.append_task_event(
    p_task_id, v_new_run_id, 'run.retry_created', 'failed', 'retrying',
    v_reason,
    jsonb_build_object(
      'previous_run_id', p_run_id,
      'attempt', v_next_attempt,
      'retry_count', COALESCE(v_task.retry_count, 0) + 1,
      'delay_seconds', v_delay
    ), NULL, NULL
  );

  RETURN v_new_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_runtime_retry(uuid, uuid, text, integer) TO service_role;
