-- AETHER PHASE A: universal durable runtime foundation
-- Task/Run/Attempt history, durable queue leasing, cancellation, timeouts,
-- retry/dead-letter handling, quotas, worker heartbeats and chronological events.

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'retrying';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'scheduled';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS timeout_ms bigint NOT NULL DEFAULT 300000,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_code text,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_idempotency_key_uidx
  ON public.tasks (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_queue_idx
  ON public.tasks (status, next_attempt_at, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS tasks_owner_status_idx
  ON public.tasks (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_project_status_idx
  ON public.tasks (project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS tasks_lease_idx
  ON public.tasks (lease_expires_at) WHERE lease_expires_at IS NOT NULL;

ALTER TABLE public.task_runs
  ADD COLUMN IF NOT EXISTS timeout_ms bigint NOT NULL DEFAULT 300000,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_code text,
  ADD COLUMN IF NOT EXISTS retryable boolean,
  ADD COLUMN IF NOT EXISTS duration_ms bigint,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE INDEX IF NOT EXISTS task_runs_queue_idx
  ON public.task_runs (status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS task_runs_task_attempt_idx
  ON public.task_runs (task_id, attempt DESC);
CREATE INDEX IF NOT EXISTS task_runs_lease_idx
  ON public.task_runs (lease_expires_at) WHERE lease_expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE CASCADE,
  sequence bigint NOT NULL,
  event_type text NOT NULL,
  from_status public.task_status,
  to_status public.task_status,
  message text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  worker_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, sequence)
);
CREATE INDEX IF NOT EXISTS task_events_task_sequence_idx
  ON public.task_events (task_id, sequence);
CREATE INDEX IF NOT EXISTS task_events_run_sequence_idx
  ON public.task_events (run_id, sequence);
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.task_events TO authenticated;
GRANT ALL ON public.task_events TO service_role;
DROP POLICY IF EXISTS "own task events" ON public.task_events;
CREATE POLICY "own task events" ON public.task_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_events.task_id
      AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE TABLE IF NOT EXISTS public.task_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  failure_code text,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dead_lettered_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (run_id)
);
CREATE INDEX IF NOT EXISTS task_dead_letters_owner_idx
  ON public.task_dead_letters (owner_id, dead_lettered_at DESC);
CREATE INDEX IF NOT EXISTS task_dead_letters_open_idx
  ON public.task_dead_letters (resolved_at) WHERE resolved_at IS NULL;
ALTER TABLE public.task_dead_letters ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.task_dead_letters TO authenticated;
GRANT ALL ON public.task_dead_letters TO service_role;
DROP POLICY IF EXISTS "own dead letters" ON public.task_dead_letters;
CREATE POLICY "own dead letters" ON public.task_dead_letters FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.runtime_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('platform','user','project')),
  scope_id uuid,
  max_concurrent integer NOT NULL DEFAULT 5 CHECK (max_concurrent > 0),
  max_queue_depth integer NOT NULL DEFAULT 100 CHECK (max_queue_depth > 0),
  max_runtime_ms bigint NOT NULL DEFAULT 18000000 CHECK (max_runtime_ms > 0),
  max_retries integer NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_id)
);
ALTER TABLE public.runtime_quotas ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.runtime_quotas TO authenticated;
GRANT ALL ON public.runtime_quotas TO service_role;
DROP POLICY IF EXISTS "runtime quotas admin read" ON public.runtime_quotas;
CREATE POLICY "runtime quotas admin read" ON public.runtime_quotas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.runtime_quotas (scope_type, scope_id, max_concurrent, max_queue_depth, max_runtime_ms, max_retries)
VALUES ('platform', NULL, 10, 1000, 18000000, 3)
ON CONFLICT (scope_type, scope_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.runtime_workers (
  worker_id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','draining','offline')),
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  current_run_id uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.runtime_workers ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.runtime_workers TO authenticated;
GRANT ALL ON public.runtime_workers TO service_role;
DROP POLICY IF EXISTS "runtime workers admin read" ON public.runtime_workers;
CREATE POLICY "runtime workers admin read" ON public.runtime_workers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.append_task_event(
  p_task_id uuid,
  p_run_id uuid,
  p_event_type text,
  p_from_status public.task_status DEFAULT NULL,
  p_to_status public.task_status DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL,
  p_worker_id text DEFAULT NULL
)
RETURNS public.task_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event public.task_events;
  v_sequence bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_task_id::text, 0));
  SELECT COALESCE(MAX(sequence), 0) + 1 INTO v_sequence
  FROM public.task_events WHERE task_id = p_task_id;
  INSERT INTO public.task_events (task_id, run_id, sequence, event_type, from_status, to_status, message, data, actor_id, worker_id)
  VALUES (p_task_id, p_run_id, v_sequence, p_event_type, p_from_status, p_to_status, p_message, COALESCE(p_data, '{}'::jsonb), p_actor_id, p_worker_id)
  RETURNING * INTO v_event;
  RETURN v_event;
END;
$$;
GRANT EXECUTE ON FUNCTION public.append_task_event(uuid, uuid, text, public.task_status, public.task_status, text, jsonb, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_next_runtime_run(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 60
)
RETURNS TABLE (
  task_id uuid,
  run_id uuid,
  owner_id uuid,
  project_id uuid,
  task_status public.task_status,
  run_status public.task_status,
  attempt integer,
  task_kind text,
  task_detail jsonb,
  inputs jsonb,
  timeout_ms bigint,
  deadline_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_run public.task_runs;
  v_task public.tasks;
  v_now timestamptz := now();
  v_lease timestamptz := v_now + make_interval(secs => GREATEST(p_lease_seconds, 10));
  v_platform_limit integer;
  v_platform_running integer;
BEGIN
  SELECT max_concurrent INTO v_platform_limit
  FROM public.runtime_quotas WHERE scope_type = 'platform' AND scope_id IS NULL;
  SELECT count(*) INTO v_platform_running
  FROM public.task_runs WHERE status = 'running' AND lease_expires_at > v_now;
  IF v_platform_limit IS NOT NULL AND v_platform_running >= v_platform_limit THEN
    RETURN;
  END IF;

  SELECT r.* INTO v_run
  FROM public.task_runs r
  JOIN public.tasks t ON t.id = r.task_id
  WHERE r.status IN ('queued','retrying')
    AND (r.next_attempt_at IS NULL OR r.next_attempt_at <= v_now)
    AND (t.status IN ('queued','retrying'))
    AND (t.next_attempt_at IS NULL OR t.next_attempt_at <= v_now)
    AND (r.deadline_at IS NULL OR r.deadline_at > v_now)
    AND (t.deadline_at IS NULL OR t.deadline_at > v_now)
  ORDER BY t.priority DESC, COALESCE(r.next_attempt_at, t.next_attempt_at, t.created_at), r.created_at
  FOR UPDATE OF r SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = v_run.task_id FOR UPDATE;

  UPDATE public.task_runs SET
    status = 'running', worker_id = p_worker_id, lease_expires_at = v_lease,
    heartbeat_at = v_now, started_at = COALESCE(started_at, v_now), updated_at = v_now
  WHERE id = v_run.id;

  UPDATE public.tasks SET
    status = 'running', worker_id = p_worker_id, lease_expires_at = v_lease,
    heartbeat_at = v_now, started_at = COALESCE(started_at, v_now), updated_at = v_now
  WHERE id = v_task.id;

  INSERT INTO public.runtime_workers (worker_id, status, current_run_id, last_heartbeat_at)
  VALUES (p_worker_id, 'running', v_run.id, v_now)
  ON CONFLICT (worker_id) DO UPDATE SET status='running', current_run_id=v_run.id, last_heartbeat_at=v_now, updated_at=v_now;

  PERFORM public.append_task_event(v_task.id, v_run.id, 'run.claimed', 'queued', 'running', 'Runtime worker claimed execution', '{}'::jsonb, NULL, p_worker_id);

  RETURN QUERY SELECT v_task.id, v_run.id, v_task.user_id, v_task.project_id,
    v_task.status, (SELECT status FROM public.task_runs WHERE id = v_run.id), v_run.attempt,
    v_task.kind, v_task.detail, v_run.inputs,
    LEAST(v_task.timeout_ms, v_run.timeout_ms),
    CASE
      WHEN v_task.deadline_at IS NULL THEN v_run.deadline_at
      WHEN v_run.deadline_at IS NULL THEN v_task.deadline_at
      ELSE LEAST(v_task.deadline_at, v_run.deadline_at)
    END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_next_runtime_run(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.requeue_expired_runtime_work(p_limit integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; r record; v_retry boolean; v_delay integer;
BEGIN
  FOR r IN SELECT tr.id AS run_id, tr.task_id, tr.attempt, tr.max_retries, tr.retry_count, tr.owner_id
    FROM public.task_runs tr
    WHERE tr.status = 'running' AND tr.lease_expires_at IS NOT NULL AND tr.lease_expires_at < now()
    ORDER BY tr.lease_expires_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    v_retry := COALESCE(r.retry_count, 0) < COALESCE(r.max_retries, 3);
    v_delay := LEAST(300, GREATEST(5, (2 ^ LEAST(COALESCE(r.retry_count, 0), 6)) * 5));
    IF v_retry THEN
      UPDATE public.task_runs SET status='retrying', retry_count=retry_count+1, next_attempt_at=now()+make_interval(secs => v_delay), worker_id=NULL, lease_expires_at=NULL, heartbeat_at=NULL, failure_code='worker_lease_expired', retryable=true, error='Worker lease expired', updated_at=now() WHERE id=r.run_id;
      UPDATE public.tasks SET status='retrying', retry_count=retry_count+1, next_attempt_at=now()+make_interval(secs => v_delay), worker_id=NULL, lease_expires_at=NULL, heartbeat_at=NULL, last_error_code='worker_lease_expired', last_error_message='Worker lease expired', updated_at=now() WHERE id=r.task_id;
      PERFORM public.append_task_event(r.task_id, r.run_id, 'run.retry_scheduled', 'running', 'retrying', 'Worker lease expired; execution will be retried', jsonb_build_object('retry_count', r.retry_count + 1, 'delay_seconds', v_delay), NULL, NULL);
    ELSE
      UPDATE public.task_runs SET status='failed', failure_code='worker_lease_expired', retryable=false, ended_at=now(), lease_expires_at=NULL, updated_at=now() WHERE id=r.run_id;
      UPDATE public.tasks SET status='failed', last_error_code='worker_lease_expired', last_error_message='Worker lease expired after retry budget was exhausted', completed_at=now(), dead_lettered_at=now(), updated_at=now() WHERE id=r.task_id;
      INSERT INTO public.task_dead_letters(task_id, run_id, owner_id, reason, failure_code, error_message, payload)
      VALUES(r.task_id, r.run_id, r.owner_id, 'retry_budget_exhausted', 'worker_lease_expired', 'Worker lease expired after retry budget was exhausted', '{}'::jsonb)
      ON CONFLICT (run_id) DO NOTHING;
      PERFORM public.append_task_event(r.task_id, r.run_id, 'run.dead_lettered', 'running', 'failed', 'Worker lease expired and retry budget was exhausted', '{}'::jsonb, NULL, NULL);
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.requeue_expired_runtime_work(integer) TO service_role;
