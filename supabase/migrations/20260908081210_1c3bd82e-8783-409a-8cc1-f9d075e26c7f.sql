CREATE TABLE public.admin_bootstrap (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid,
  completed_email text
);
GRANT ALL ON public.admin_bootstrap TO service_role;
ALTER TABLE public.admin_bootstrap ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.admin_bootstrap_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_bootstrap_attempts_fp_idx ON public.admin_bootstrap_attempts (fingerprint, attempted_at DESC);
GRANT ALL ON public.admin_bootstrap_attempts TO service_role;
ALTER TABLE public.admin_bootstrap_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
  attempt integer NOT NULL DEFAULT 1,
  status public.task_status NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  ended_at timestamptz,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  retry_of uuid REFERENCES public.task_runs(id) ON DELETE SET NULL,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_runs_task_idx ON public.task_runs (task_id, attempt DESC);
CREATE INDEX task_runs_owner_idx ON public.task_runs (owner_id, created_at DESC);
GRANT SELECT ON public.task_runs TO authenticated;
GRANT ALL ON public.task_runs TO service_role;
ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their task runs" ON public.task_runs FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Admins read all task runs" ON public.task_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER task_runs_updated_at BEFORE UPDATE ON public.task_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  audience text NOT NULL DEFAULT 'user' CHECK (audience IN ('user','admin')),
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  resource_type text,
  resource_id uuid,
  link text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','read')),
  delivery_attempts integer NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx ON public.notifications (recipient_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recipients read their notifications" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Recipients update their notifications" ON public.notifications FOR UPDATE TO authenticated USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());