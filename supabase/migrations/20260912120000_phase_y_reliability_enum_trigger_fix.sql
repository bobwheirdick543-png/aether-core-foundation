-- Phase Y reliability fix: task_runs uses task_status enum values completed/failed/cancelled.
-- scheduled_runs intentionally uses succeeded/failed/cancelled. Compare the enum as text
-- before translating it to the scheduled_runs status vocabulary.
CREATE OR REPLACE FUNCTION public.sync_scheduled_run_from_task_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF new.status::text IN ('completed', 'failed', 'cancelled') THEN
    UPDATE public.scheduled_runs
    SET status = CASE
        WHEN new.status::text = 'completed' THEN 'succeeded'
        WHEN new.status::text = 'cancelled' THEN 'cancelled'
        ELSE 'failed'
      END,
      finished_at = COALESCE(finished_at, now()),
      result = CASE WHEN new.status::text = 'completed' THEN COALESCE(new.outputs, '{}'::jsonb) ELSE result END,
      error = CASE WHEN new.status::text = 'completed' THEN NULL ELSE COALESCE(new.error, new.failure_code) END,
      lease_token = NULL,
      lease_expires_at = NULL,
      updated_at = now()
    WHERE task_run_id = new.id
      AND status = 'running';
  END IF;
  RETURN new;
END;
$function$;
