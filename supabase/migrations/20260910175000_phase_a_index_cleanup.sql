-- The base schema already has an equivalent task_runs task index.
-- Avoid carrying a duplicate index introduced during Phase A.
DROP INDEX IF EXISTS public.task_runs_task_attempt_idx;
