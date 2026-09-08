-- AETHER RUNTIME EXTENSIONS
-- Supports Task/Run engine, notifications, knowledge approval, and archive.
-- Safe to run on top of the existing schema. Idempotent where possible.

-- ------------------------------------------------------------
-- Notifications (ownership-scoped)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'user' CHECK (audience IN ('user', 'admin')),
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  resource_type text,
  resource_id text,
  link text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'read')),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  delivered_at timestamptz
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON public.notifications (status);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can update own notifications (read)" ON public.notifications;
CREATE POLICY "Users can update own notifications (read)"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Service role / admin inserts are done via supabaseAdmin (bypasses RLS)

-- ------------------------------------------------------------
-- Task runs: idempotency + agent_key support
-- ------------------------------------------------------------
ALTER TABLE public.task_runs
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS agent_key text,
  ADD COLUMN IF NOT EXISTS retry_of uuid REFERENCES public.task_runs(id),
  ADD COLUMN IF NOT EXISTS error text;

CREATE UNIQUE INDEX IF NOT EXISTS task_runs_idempotency_key_uidx
  ON public.task_runs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ------------------------------------------------------------
-- Knowledge: approval tracking
-- ------------------------------------------------------------
ALTER TABLE public.knowledge_entries
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_version integer DEFAULT 1;

-- ------------------------------------------------------------
-- Reports: ensure file_path and status columns exist
-- ------------------------------------------------------------
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS source_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS file_path text;

-- ------------------------------------------------------------
-- Audit helper index
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON public.audit_logs (actor_id, created_at DESC);
