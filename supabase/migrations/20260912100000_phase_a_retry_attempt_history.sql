-- Phase A hardening: every retry is a new immutable run attempt.
-- The previous attempt remains terminal and auditable; only the new attempt is queued.
CREATE OR REPLACE FUNCTION public.requeue_expired_runtime_work(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  r record;
  v_delay integer;
  v_cancelled boolean;
  v_timed_out boolean;
  v_next_attempt integer;
  v_new_run_id uuid;
BEGIN
  FOR r IN
    SELECT
      tr.id AS run_id,
      tr.task_id,
      tr.attempt,
      tr.max_retries,
      tr.retry_count,
      tr.owner_id,
      tr.agent_id,
      tr.agent_key,
      tr.inputs,
      tr.timeout_ms AS run_timeout_ms,
      tr.deadline_at AS run_deadline,
      tr.cancel_requested_at AS run_cancel,
      t.cancel_requested_at AS task_cancel,
      t.deadline_at AS task_deadline
    FROM public.task_runs tr
    JOIN public.tasks t ON t.id = tr.task_id
    WHERE tr.status = 'running'
      AND tr.lease_expires_at IS NOT NULL
      AND tr.lease_expires_at < now()
    ORDER BY tr.lease_expires_at
    LIMIT p_limit
    FOR UPDATE OF tr SKIP LOCKED
  LOOP
    v_cancelled := r.run_cancel IS NOT NULL OR r.task_cancel IS NOT NULL;
    v_timed_out :=
      (r.task_deadline IS NOT NULL AND r.task_deadline <= now()) OR
      (r.run_deadline IS NOT NULL AND r.run_deadline <= now());

    IF v_cancelled THEN
      UPDATE public.task_runs
      SET status = 'cancelled', failure_code = 'cancelled', retryable = false,
          ended_at = now(), worker_id = NULL, lease_expires_at = NULL,
          heartbeat_at = NULL, updated_at = now()
      WHERE id = r.run_id;

      UPDATE public.tasks
      SET status = 'cancelled', completed_at = now(), worker_id = NULL,
          lease_expires_at = NULL, heartbeat_at = NULL, updated_at = now()
      WHERE id = r.task_id;

      PERFORM public.append_task_event(
        r.task_id, r.run_id, 'run.cancelled', 'running', 'cancelled',
        'Cancellation request observed after worker lease expiry', '{}'::jsonb, NULL, NULL
      );

    ELSIF v_timed_out THEN
      UPDATE public.task_runs
      SET status = 'failed', failure_code = 'timeout_budget_exhausted', retryable = false,
          ended_at = now(), worker_id = NULL, lease_expires_at = NULL,
          heartbeat_at = NULL, error = 'Task runtime deadline exceeded', updated_at = now()
      WHERE id = r.run_id;

      UPDATE public.tasks
      SET status = 'failed', last_error_code = 'timeout_budget_exhausted',
          last_error_message = 'Task runtime deadline exceeded', completed_at = now(),
          dead_lettered_at = now(), worker_id = NULL, lease_expires_at = NULL,
          heartbeat_at = NULL, updated_at = now()
      WHERE id = r.task_id;

      INSERT INTO public.task_dead_letters
        (task_id, run_id, owner_id, reason, failure_code, error_message, payload)
      VALUES
        (r.task_id, r.run_id, r.owner_id, 'timeout_budget_exhausted',
         'timeout_budget_exhausted', 'Task runtime deadline exceeded', '{}'::jsonb)
      ON CONFLICT (run_id) DO NOTHING;

      PERFORM public.append_task_event(
        r.task_id, r.run_id, 'run.dead_lettered', 'running', 'failed',
        'Task runtime deadline exceeded', '{}'::jsonb, NULL, NULL
      );

    ELSIF COALESCE(r.retry_count, 0) < COALESCE(r.max_retries, 3) THEN
      v_delay := LEAST(300, GREATEST(5, (2 ^ LEAST(COALESCE(r.retry_count, 0), 6)) * 5));
      v_next_attempt := COALESCE(r.attempt, 1) + 1;

      -- Preserve the failed attempt instead of mutating its history.
      UPDATE public.task_runs
      SET status = 'failed', failure_code = 'worker_lease_expired', retryable = true,
          ended_at = now(), worker_id = NULL, lease_expires_at = NULL,
          heartbeat_at = NULL, error = 'Worker lease expired', updated_at = now()
      WHERE id = r.run_id;

      UPDATE public.tasks
      SET status = 'retrying', retry_count = retry_count + 1,
          next_attempt_at = now() + make_interval(secs => v_delay),
          worker_id = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
          last_error_code = 'worker_lease_expired',
          last_error_message = 'Worker lease expired', updated_at = now()
      WHERE id = r.task_id;

      INSERT INTO public.task_runs
        (task_id, owner_id, agent_id, agent_key, attempt, status, inputs, outputs,
         retry_of, timeout_ms, deadline_at, max_retries, retry_count, next_attempt_at)
      VALUES
        (r.task_id, r.owner_id, r.agent_id, r.agent_key, v_next_attempt, 'retrying',
         COALESCE(r.inputs, '{}'::jsonb), '{}'::jsonb, r.run_id,
         r.run_timeout_ms, r.run_deadline, r.max_retries, 0,
         now() + make_interval(secs => v_delay))
      RETURNING id INTO v_new_run_id;

      PERFORM public.append_task_event(
        r.task_id, v_new_run_id, 'run.retry_created', 'failed', 'retrying',
        'Worker lease expired; a new immutable execution attempt was created',
        jsonb_build_object(
          'previous_run_id', r.run_id,
          'attempt', v_next_attempt,
          'retry_count', COALESCE(r.retry_count, 0) + 1,
          'delay_seconds', v_delay
        ), NULL, NULL
      );

    ELSE
      UPDATE public.task_runs
      SET status = 'failed', failure_code = 'worker_lease_expired', retryable = false,
          ended_at = now(), worker_id = NULL, lease_expires_at = NULL,
          heartbeat_at = NULL,
          error = 'Worker lease expired after retry budget was exhausted', updated_at = now()
      WHERE id = r.run_id;

      UPDATE public.tasks
      SET status = 'failed', last_error_code = 'worker_lease_expired',
          last_error_message = 'Worker lease expired after retry budget was exhausted',
          completed_at = now(), dead_lettered_at = now(), worker_id = NULL,
          lease_expires_at = NULL, heartbeat_at = NULL, updated_at = now()
      WHERE id = r.task_id;

      INSERT INTO public.task_dead_letters
        (task_id, run_id, owner_id, reason, failure_code, error_message, payload)
      VALUES
        (r.task_id, r.run_id, r.owner_id, 'retry_budget_exhausted',
         'worker_lease_expired', 'Worker lease expired after retry budget was exhausted', '{}'::jsonb)
      ON CONFLICT (run_id) DO NOTHING;

      PERFORM public.append_task_event(
        r.task_id, r.run_id, 'run.dead_lettered', 'running', 'failed',
        'Worker lease expired and retry budget was exhausted', '{}'::jsonb, NULL, NULL
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.requeue_expired_runtime_work(integer) TO service_role;
