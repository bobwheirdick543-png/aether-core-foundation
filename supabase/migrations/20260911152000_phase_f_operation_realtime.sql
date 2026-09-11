-- Phase F F11: persisted task state is the source of truth; Realtime is only
-- a delivery mechanism for waking the UI to re-read that durable state.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'task_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_events;
  END IF;
END $$;

-- Realtime filters are evaluated through normal table RLS. Keep the tables
-- protected; never make task/event rows publicly readable for convenience.
