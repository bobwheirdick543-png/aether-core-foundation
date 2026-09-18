-- Aether Core Foundation / Supabase alignment for the current main backend contract.
-- Idempotent: only adds missing compatibility, RLS, and platform-knowledge plumbing.

-- 1) Agent conversation messages: owner UPDATE is required for edit + soft-delete.
ALTER TABLE public.agent_conversation_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "update own agent messages" ON public.agent_conversation_messages;
CREATE POLICY "update own agent messages"
  ON public.agent_conversation_messages
  FOR UPDATE
  TO authenticated
  USING ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((owner_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Keep hard DELETE unavailable to authenticated users; the application bins messages
-- by updating metadata instead.

-- 2) Tasks: current workstation enqueue sends owner_id, while the legacy runtime
-- schema uses user_id. Add the compatibility column and synchronize both identities.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS owner_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_owner_id_fkey'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.tasks
SET owner_id = user_id
WHERE owner_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_task_owner_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    NEW.user_id := NEW.owner_id;
  ELSIF NEW.owner_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.owner_id := NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_owner_identity_compatibility ON public.tasks;
CREATE TRIGGER tasks_owner_identity_compatibility
BEFORE INSERT OR UPDATE OF user_id, owner_id
ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_owner_identity();

-- 3) Knowledge acquisition jobs: the current enqueue path omits owner_id and
-- dedupe_key, while both are required by the existing schema. Derive owner_id
-- from the task and provide a deterministic dedupe key from task_id.
ALTER TABLE public.aether_knowledge_acquisition_jobs
  ALTER COLUMN dedupe_key SET DEFAULT ('knowledge-acquisition:' || gen_random_uuid()::text);

CREATE OR REPLACE FUNCTION public.sync_knowledge_acquisition_job_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF NEW.owner_id IS NULL AND NEW.task_id IS NOT NULL THEN
    SELECT COALESCE(t.owner_id, t.user_id)
      INTO v_owner_id
    FROM public.tasks t
    WHERE t.id = NEW.task_id;

    NEW.owner_id := v_owner_id;
  END IF;

  IF NEW.dedupe_key IS NULL OR btrim(NEW.dedupe_key) = '' THEN
    NEW.dedupe_key := 'knowledge-acquisition:' || NEW.task_id::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_acquisition_job_owner_compatibility
  ON public.aether_knowledge_acquisition_jobs;
CREATE TRIGGER knowledge_acquisition_job_owner_compatibility
BEFORE INSERT OR UPDATE OF task_id, owner_id, dedupe_key
ON public.aether_knowledge_acquisition_jobs
FOR EACH ROW
EXECUTE FUNCTION public.sync_knowledge_acquisition_job_owner();

-- 4) Explicit platform publication state for approved production knowledge.
-- Approval code already moves knowledge_entries to production and records
-- approved_by/approved_at. This trigger makes that approval the durable
-- platform-publication boundary without exposing unapproved knowledge.
ALTER TABLE public.knowledge_entries
  ADD COLUMN IF NOT EXISTS platform_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS platform_published_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_platform_knowledge_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.stage = 'production' AND NEW.approved_by IS NOT NULL THEN
    NEW.platform_published := true;
    IF NEW.platform_published_at IS NULL THEN
      NEW.platform_published_at := now();
    END IF;
  ELSE
    NEW.platform_published := false;
    NEW.platform_published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_entries_platform_publication
  ON public.knowledge_entries;
CREATE TRIGGER knowledge_entries_platform_publication
BEFORE INSERT OR UPDATE OF stage, approved_by, approved_at
ON public.knowledge_entries
FOR EACH ROW
EXECUTE FUNCTION public.sync_platform_knowledge_publication();

CREATE INDEX IF NOT EXISTS knowledge_entries_platform_published_idx
  ON public.knowledge_entries (platform_published, updated_at DESC);

-- 5) Server-only platform knowledge search for the AAX intelligence backend.
-- It reads only explicitly published production knowledge. No public/authenticated
-- EXECUTE is granted.
CREATE OR REPLACE FUNCTION public.aax_platform_knowledge_search(
  p_query text,
  p_limit integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  confidence numeric,
  current_version integer,
  sources jsonb,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    e.id,
    e.title,
    e.body,
    e.confidence,
    e.current_version,
    e.sources,
    ts_rank(
      to_tsvector('simple', coalesce(e.title, '') || ' ' || coalesce(e.body, '')),
      websearch_to_tsquery('simple', left(coalesce(p_query, ''), 2000))
    )::real AS rank
  FROM public.knowledge_entries e
  WHERE e.stage = 'production'
    AND e.platform_published = true
    AND websearch_to_tsquery('simple', left(coalesce(p_query, ''), 2000))
        @@ to_tsvector('simple', coalesce(e.title, '') || ' ' || coalesce(e.body, ''))
  ORDER BY rank DESC, e.updated_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 8), 20));
$$;

REVOKE ALL ON FUNCTION public.aax_platform_knowledge_search(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.aax_platform_knowledge_search(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.aax_platform_knowledge_search(text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.aax_platform_knowledge_search(text, integer) TO service_role;

-- 6) Keep the required RPC surface explicit. Do not recreate existing lifecycle/
-- orchestration functions here; their existence is verified separately.
