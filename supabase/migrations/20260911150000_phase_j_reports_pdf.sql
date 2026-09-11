-- Phase J: deterministic report artifacts + private storage.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_run_id UUID REFERENCES public.verification_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating','ready','failed','archived')),
  file_path TEXT,
  file_sha256 TEXT,
  byte_size BIGINT CHECK (byte_size IS NULL OR byte_size >= 0),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  report_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_run_id UUID REFERENCES public.task_runs(id) ON DELETE SET NULL,
  error TEXT,
  archived_at TIMESTAMPTZ,
  idempotency_key TEXT UNIQUE,
  UNIQUE (report_id, version)
);
CREATE INDEX IF NOT EXISTS report_versions_owner_idx ON public.report_versions(owner_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS report_versions_report_idx ON public.report_versions(report_id, version DESC);
GRANT SELECT ON public.report_versions TO authenticated;
GRANT ALL ON public.report_versions TO service_role;
ALTER TABLE public.report_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own report versions" ON public.report_versions;
CREATE POLICY "own report versions" ON public.report_versions FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, UPDATE, DELETE ON public.report_versions FROM authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('aether-reports','aether-reports',false,52428800,ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=52428800, allowed_mime_types=ARRAY['application/pdf'];

DROP POLICY IF EXISTS "aether reports no direct client access" ON storage.objects;
CREATE POLICY "aether reports no direct client access" ON storage.objects FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.set_report_version_current()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ready' THEN
    UPDATE public.reports SET current_version=NEW.version, file_path=NEW.file_path, updated_at=now()
    WHERE id=NEW.report_id AND owner_id=NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS report_versions_current ON public.report_versions;
CREATE TRIGGER report_versions_current AFTER INSERT OR UPDATE OF status,file_path ON public.report_versions
FOR EACH ROW EXECUTE FUNCTION public.set_report_version_current();
REVOKE EXECUTE ON FUNCTION public.set_report_version_current() FROM public, anon, authenticated;
