-- AETHER PHASE Y: DATA LIFECYCLE, RECOVERY & SAFETY BIN
-- Delete means preserve in the Safety Bin; permanent destruction is a separate,
-- explicitly authorized operation. This migration is intentionally repeatable.

CREATE TABLE IF NOT EXISTS public.lifecycle_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type text NOT NULL UNIQUE,
  retention_days integer NOT NULL CHECK (retention_days >= 0),
  action text NOT NULL CHECK (action IN ('archive','delete')) DEFAULT 'archive',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lifecycle_policies ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.lifecycle_policies TO authenticated;
GRANT ALL ON public.lifecycle_policies TO service_role;
DROP POLICY IF EXISTS "lifecycle policies admin read" ON public.lifecycle_policies;
CREATE POLICY "lifecycle policies admin read" ON public.lifecycle_policies FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.lifecycle_policies(resource_type, retention_days, action) VALUES
 ('tasks', 365, 'archive'),
 ('task_events', 180, 'delete'),
 ('task_runs', 365, 'archive'),
 ('research_sources', 365, 'archive'),
 ('research_runs', 365, 'archive'),
 ('reports', 730, 'archive'),
 ('files', 730, 'archive'),
 ('notifications', 180, 'delete'),
 ('observability_events', 180, 'delete'),
 ('observability_spans', 180, 'delete'),
 ('observability_metric_samples', 180, 'delete')
ON CONFLICT (resource_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.safety_bin_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_schema text NOT NULL,
  source_table text NOT NULL,
  source_object_id text,
  source_owner_id uuid,
  source_project_id uuid,
  object_type text NOT NULL,
  object_name text,
  original_location text,
  original_created_at timestamptz,
  original_updated_at timestamptz,
  deleted_by_id uuid,
  deleted_by_email text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deletion_reason text,
  deletion_method text NOT NULL DEFAULT 'delete',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  recovery_status text NOT NULL DEFAULT 'available' CHECK (recovery_status IN ('available','restored','restore_failed','frozen')),
  permanent_deletion_status text NOT NULL DEFAULT 'preserved' CHECK (permanent_deletion_status IN ('preserved','purge_requested','purged')),
  related_task_id uuid,
  related_run_id uuid,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safety_bin_items_deleted_by_idx ON public.safety_bin_items(deleted_by_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS safety_bin_items_owner_idx ON public.safety_bin_items(source_owner_id, deleted_at DESC);
CREATE INDEX IF NOT EXISTS safety_bin_items_source_idx ON public.safety_bin_items(source_table, object_type, deleted_at DESC);
CREATE INDEX IF NOT EXISTS safety_bin_items_hash_idx ON public.safety_bin_items(content_hash);
CREATE INDEX IF NOT EXISTS safety_bin_items_correlation_idx ON public.safety_bin_items(correlation_id);
ALTER TABLE public.safety_bin_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.safety_bin_items TO authenticated;
GRANT ALL ON public.safety_bin_items TO service_role;
DROP POLICY IF EXISTS "safety bin owner or admin read" ON public.safety_bin_items;
CREATE POLICY "safety bin owner or admin read" ON public.safety_bin_items FOR SELECT TO authenticated
  USING (source_owner_id = auth.uid() OR deleted_by_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "safety bin admin update" ON public.safety_bin_items;
CREATE POLICY "safety bin admin update" ON public.safety_bin_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.safety_bin_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.safety_bin_items(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL,
  content_hash text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, version)
);
ALTER TABLE public.safety_bin_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.safety_bin_versions TO authenticated;
GRANT ALL ON public.safety_bin_versions TO service_role;
CREATE POLICY "safety bin versions owner or admin" ON public.safety_bin_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.safety_bin_items i WHERE i.id = item_id AND (i.source_owner_id = auth.uid() OR i.deleted_by_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TABLE IF NOT EXISTS public.safety_bin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.safety_bin_items(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  result text NOT NULL DEFAULT 'success',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safety_bin_events_item_idx ON public.safety_bin_events(item_id, created_at DESC);
ALTER TABLE public.safety_bin_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.safety_bin_events TO authenticated;
GRANT ALL ON public.safety_bin_events TO service_role;
CREATE POLICY "safety bin events owner or admin" ON public.safety_bin_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.safety_bin_items i WHERE i.id = item_id AND (i.source_owner_id = auth.uid() OR i.deleted_by_id = auth.uid())));

CREATE TABLE IF NOT EXISTS public.safety_bin_restorations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.safety_bin_items(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  restored_at timestamptz NOT NULL DEFAULT now(),
  target_table text NOT NULL,
  target_object_id text,
  result text NOT NULL,
  error_message text
);
ALTER TABLE public.safety_bin_restorations ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.safety_bin_restorations TO authenticated;
GRANT ALL ON public.safety_bin_restorations TO service_role;
CREATE POLICY "safety bin restorations owner or admin" ON public.safety_bin_restorations FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.safety_bin_items i WHERE i.id = item_id AND i.source_owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.safety_bin_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  item_ids uuid[] NOT NULL,
  format text NOT NULL CHECK (format IN ('json','pdf')),
  storage_path text,
  file_name text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','completed','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.safety_bin_exports ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.safety_bin_exports TO authenticated;
GRANT ALL ON public.safety_bin_exports TO service_role;
CREATE POLICY "safety bin exports owner or admin" ON public.safety_bin_exports FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.safety_bin_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  generated_by uuid NOT NULL,
  title text NOT NULL,
  item_count integer NOT NULL DEFAULT 0,
  storage_path text,
  file_name text,
  report_version integer NOT NULL DEFAULT 1,
  generated_at timestamptz NOT NULL DEFAULT now(),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','completed','failed')),
  error_message text
);
ALTER TABLE public.safety_bin_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.safety_bin_reports TO authenticated;
GRANT ALL ON public.safety_bin_reports TO service_role;
CREATE POLICY "safety bin reports owner or admin" ON public.safety_bin_reports FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR generated_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.safety_bin_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','frozen','closed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
ALTER TABLE public.safety_bin_investigations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.safety_bin_investigations TO authenticated;
GRANT ALL ON public.safety_bin_investigations TO service_role;
CREATE POLICY "safety bin investigations owner or admin" ON public.safety_bin_investigations FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.safety_bin_purge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.safety_bin_items(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  approved_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','completed')),
  reason text
);
ALTER TABLE public.safety_bin_purge_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.safety_bin_purge_requests TO authenticated;
GRANT ALL ON public.safety_bin_purge_requests TO service_role;
CREATE POLICY "safety bin purge owner or admin" ON public.safety_bin_purge_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "safety bin purge request" ON public.safety_bin_purge_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.safety_bin_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','agent','system')),
  content text NOT NULL,
  result_item_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safety_bin_chat_owner_idx ON public.safety_bin_chat_messages(owner_id, created_at);
ALTER TABLE public.safety_bin_chat_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.safety_bin_chat_messages TO authenticated;
GRANT ALL ON public.safety_bin_chat_messages TO service_role;
CREATE POLICY "safety bin chat owner or admin" ON public.safety_bin_chat_messages FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Private report bucket. The browser never needs a public URL; server code creates signed downloads.
INSERT INTO storage.buckets(id, name, public)
VALUES ('aether-safety-bin-reports', 'aether-safety-bin-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.safety_bin_actor_email(p_actor uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT email::text FROM auth.users WHERE id = p_actor;
$$;

CREATE OR REPLACE FUNCTION public.capture_deleted_row_to_safety_bin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_content jsonb := to_jsonb(OLD);
  v_owner uuid;
  v_project uuid;
  v_object_id text;
  v_object_name text;
  v_created timestamptz;
  v_updated timestamptz;
  v_deleted_by uuid := auth.uid();
  v_deleted_email text := COALESCE((auth.jwt() ->> 'email'), public.safety_bin_actor_email(v_deleted_by));
  v_item uuid;
  v_hash text;
BEGIN
  IF TG_TABLE_NAME LIKE 'safety_bin_%' OR TG_TABLE_NAME IN ('lifecycle_policies') THEN RETURN OLD; END IF;

  v_owner := CASE
    WHEN v_content ? 'owner_id' AND jsonb_typeof(v_content->'owner_id') = 'string' THEN (v_content->>'owner_id')::uuid
    WHEN v_content ? 'user_id' AND jsonb_typeof(v_content->'user_id') = 'string' THEN (v_content->>'user_id')::uuid
    WHEN v_content ? 'recipient_id' AND jsonb_typeof(v_content->'recipient_id') = 'string' THEN (v_content->>'recipient_id')::uuid
    ELSE NULL END;
  v_project := CASE WHEN v_content ? 'project_id' AND jsonb_typeof(v_content->'project_id') = 'string' THEN (v_content->>'project_id')::uuid ELSE NULL END;
  v_object_id := COALESCE(v_content->>'id', v_content->>'object_id', v_content->>'key');
  v_object_name := COALESCE(v_content->>'name', v_content->>'title', v_content->>'file_name');
  v_created := CASE WHEN v_content ? 'created_at' THEN (v_content->>'created_at')::timestamptz ELSE NULL END;
  v_updated := CASE WHEN v_content ? 'updated_at' THEN (v_content->>'updated_at')::timestamptz ELSE NULL END;
  v_hash := encode(digest(convert_to(v_content::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.safety_bin_items(
    source_schema, source_table, source_object_id, source_owner_id, source_project_id,
    object_type, object_name, original_location, original_created_at, original_updated_at,
    deleted_by_id, deleted_by_email, deleted_at, content, content_hash, correlation_id
  ) VALUES (
    TG_TABLE_SCHEMA, TG_TABLE_NAME, v_object_id, v_owner, v_project,
    TG_TABLE_NAME, v_object_name,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || COALESCE(':' || v_object_id, ''),
    v_created, v_updated, v_deleted_by, v_deleted_email, now(), v_content, v_hash, gen_random_uuid()
  ) RETURNING id INTO v_item;

  INSERT INTO public.safety_bin_versions(item_id, version, content, content_hash)
  VALUES (v_item, 1, v_content, v_hash);
  INSERT INTO public.safety_bin_events(item_id, actor_id, actor_email, action, details, correlation_id)
  SELECT v_item, v_deleted_by, v_deleted_email, 'deleted', jsonb_build_object('source_table', TG_TABLE_NAME, 'source_object_id', v_object_id), correlation_id
  FROM public.safety_bin_items WHERE id = v_item;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  -- Safety preservation is part of the lifecycle boundary. A delete must not silently
  -- bypass it; abort the original delete if evidence capture fails.
  RAISE EXCEPTION 'Safety Bin capture failed for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
END;
$$;

-- Install the delete boundary on every existing public application table except Safety Bin metadata.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT LIKE 'safety_bin_%'
      AND c.relname NOT IN ('lifecycle_policies')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS safety_bin_capture_delete ON %I.%I', r.schema_name, r.table_name);
    EXECUTE format('CREATE TRIGGER safety_bin_capture_delete BEFORE DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.capture_deleted_row_to_safety_bin()', r.schema_name, r.table_name);
  END LOOP;
END $$;

-- Durable integrity check.
CREATE OR REPLACE FUNCTION public.verify_safety_bin_integrity(p_item_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_content jsonb; v_hash text; v_expected text;
BEGIN
  SELECT content, content_hash INTO v_content, v_expected FROM public.safety_bin_items WHERE id = p_item_id;
  IF v_content IS NULL THEN RETURN false; END IF;
  v_hash := encode(digest(convert_to(v_content::text, 'UTF8'), 'sha256'), 'hex');
  RETURN v_hash = v_expected;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_safety_bin_integrity(uuid) TO authenticated, service_role;

-- Restore preserves the deletion record and writes a chain-of-custody event.
CREATE OR REPLACE FUNCTION public.restore_safety_bin_item(p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.safety_bin_items; v_actor uuid := auth.uid(); v_table_exists boolean; v_new_id text; v_error text;
BEGIN
  SELECT * INTO i FROM public.safety_bin_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'message','Safety Bin item not found'); END IF;
  IF v_actor IS NULL OR NOT (i.source_owner_id = v_actor OR i.deleted_by_id = v_actor OR public.has_role(v_actor,'admin')) THEN
    RAISE EXCEPTION 'Safety Bin restore is not authorized';
  END IF;
  IF i.permanent_deletion_status = 'purged' THEN RETURN jsonb_build_object('ok',false,'message','Item was permanently purged'); END IF;
  IF i.recovery_status = 'frozen' THEN RETURN jsonb_build_object('ok',false,'message','Item is frozen by an investigation'); END IF;
  IF NOT public.verify_safety_bin_integrity(p_item_id) THEN
    UPDATE public.safety_bin_items SET recovery_status='restore_failed' WHERE id=p_item_id;
    RETURN jsonb_build_object('ok',false,'message','Integrity verification failed');
  END IF;
  SELECT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=i.source_schema AND c.relname=i.source_table AND c.relkind='r') INTO v_table_exists;
  IF NOT v_table_exists THEN RETURN jsonb_build_object('ok',false,'message','Original table no longer exists'); END IF;
  BEGIN
    EXECUTE format('INSERT INTO %I.%I SELECT * FROM jsonb_populate_record(NULL::%I.%I, $1) RETURNING to_jsonb(%I.*)->>''id''', i.source_schema, i.source_table, i.source_schema, i.source_table, i.source_table) USING i.content INTO v_new_id;
    UPDATE public.safety_bin_items SET recovery_status='restored' WHERE id=p_item_id;
    INSERT INTO public.safety_bin_restorations(item_id,actor_id,target_table,target_object_id,result) VALUES(p_item_id,v_actor,i.source_schema||'.'||i.source_table,v_new_id,'restored');
    INSERT INTO public.safety_bin_events(item_id,actor_id,actor_email,action,details,correlation_id) VALUES(p_item_id,v_actor,public.safety_bin_actor_email(v_actor),'restored',jsonb_build_object('target_table',i.source_table,'target_object_id',v_new_id),i.correlation_id);
    RETURN jsonb_build_object('ok',true,'restored_id',v_new_id);
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    UPDATE public.safety_bin_items SET recovery_status='restore_failed' WHERE id=p_item_id;
    INSERT INTO public.safety_bin_restorations(item_id,actor_id,target_table,target_object_id,result,error_message) VALUES(p_item_id,v_actor,i.source_schema||'.'||i.source_table,v_new_id,'failed',v_error);
    RETURN jsonb_build_object('ok',false,'message','Restore failed','detail',v_error);
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.restore_safety_bin_item(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_safety_bin_item(p_item_id uuid, p_reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_frozen boolean;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin') THEN RAISE EXCEPTION 'Permanent Safety Bin purge requires administrator authorization'; END IF;
  SELECT recovery_status='frozen' INTO v_frozen FROM public.safety_bin_items WHERE id=p_item_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_frozen THEN RAISE EXCEPTION 'Frozen evidence cannot be permanently purged'; END IF;
  INSERT INTO public.safety_bin_events(item_id,actor_id,actor_email,action,details) VALUES(p_item_id,v_actor,public.safety_bin_actor_email(v_actor),'purged',jsonb_build_object('reason',left(COALESCE(p_reason,'authorized purge'),500)));
  DELETE FROM public.safety_bin_items WHERE id=p_item_id;
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.purge_safety_bin_item(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.freeze_safety_bin_item(p_item_id uuid, p_frozen boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin') THEN RAISE EXCEPTION 'Investigation freeze requires administrator authorization'; END IF;
  UPDATE public.safety_bin_items SET recovery_status=CASE WHEN p_frozen THEN 'frozen' ELSE 'available' END WHERE id=p_item_id;
  INSERT INTO public.safety_bin_events(item_id,actor_id,actor_email,action,details) VALUES(p_item_id,v_actor,public.safety_bin_actor_email(v_actor),CASE WHEN p_frozen THEN 'frozen' ELSE 'unfrozen' END,'{}');
  RETURN FOUND;
END;
$$;
GRANT EXECUTE ON FUNCTION public.freeze_safety_bin_item(uuid,boolean) TO authenticated;

-- User export/deletion workflow records. The actual auth-user destruction remains an
-- explicit server/admin operation so product policy can be checked before deletion.
CREATE TABLE IF NOT EXISTS public.user_lifecycle_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('export','deletion')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','processing','completed','rejected','failed')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text
);
ALTER TABLE public.user_lifecycle_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.user_lifecycle_requests TO authenticated;
GRANT ALL ON public.user_lifecycle_requests TO service_role;
CREATE POLICY "own lifecycle requests" ON public.user_lifecycle_requests FOR SELECT TO authenticated USING (user_id=auth.uid() OR requested_by=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create lifecycle requests" ON public.user_lifecycle_requests FOR INSERT TO authenticated WITH CHECK (requested_by=auth.uid() AND user_id=auth.uid());

-- Default retention is intentionally independent from the Safety Bin: lifecycle jobs may
-- remove source records, but the delete trigger preserves their evidence in the bin.
CREATE OR REPLACE FUNCTION public.apply_phase_y_retention(p_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_count integer := 0; v_cutoff timestamptz; v_sql text; v_deleted integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Retention execution requires administrator authorization'; END IF;
  FOR p IN SELECT * FROM public.lifecycle_policies WHERE enabled ORDER BY resource_type LOOP
    v_cutoff := now() - make_interval(days => p.retention_days);
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=p.resource_type AND c.relkind='r') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p.resource_type AND column_name='created_at') THEN
        IF p.action='delete' THEN
          v_sql := format('DELETE FROM public.%I WHERE created_at < $1 AND id IN (SELECT id FROM public.%I WHERE created_at < $1 LIMIT $2)', p.resource_type, p.resource_type);
          EXECUTE v_sql USING v_cutoff, p_limit;
          GET DIAGNOSTICS v_deleted = ROW_COUNT;
          v_count := v_count + v_deleted;
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p.resource_type AND column_name='archived') THEN
          v_sql := format('UPDATE public.%I SET archived=true WHERE created_at < $1 AND archived=false AND id IN (SELECT id FROM public.%I WHERE created_at < $1 AND archived=false LIMIT $2)', p.resource_type, p.resource_type);
          EXECUTE v_sql USING v_cutoff, p_limit;
          GET DIAGNOSTICS v_deleted = ROW_COUNT;
          v_count := v_count + v_deleted;
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_phase_y_retention(integer) TO authenticated, service_role;
