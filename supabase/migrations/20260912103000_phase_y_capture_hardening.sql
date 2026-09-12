-- Phase Y reliability hardening: malformed legacy metadata must never make ordinary
-- deletes fail, and retention must have an explicit outcome even when a table has no
-- archived column.

CREATE OR REPLACE FUNCTION public.safety_bin_safe_uuid(p_value text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_value IS NULL OR p_value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RETURN NULL; END IF;
  RETURN p_value::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.safety_bin_safe_timestamptz(p_value text)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value)='' THEN RETURN NULL; END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
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
    WHEN v_content ? 'owner_id' THEN public.safety_bin_safe_uuid(v_content->>'owner_id')
    WHEN v_content ? 'user_id' THEN public.safety_bin_safe_uuid(v_content->>'user_id')
    WHEN v_content ? 'recipient_id' THEN public.safety_bin_safe_uuid(v_content->>'recipient_id')
    ELSE NULL END;
  v_project := CASE WHEN v_content ? 'project_id' THEN public.safety_bin_safe_uuid(v_content->>'project_id') ELSE NULL END;
  v_object_id := COALESCE(v_content->>'id', v_content->>'object_id', v_content->>'key');
  v_object_name := COALESCE(v_content->>'name', v_content->>'title', v_content->>'file_name');
  v_created := public.safety_bin_safe_timestamptz(v_content->>'created_at');
  v_updated := public.safety_bin_safe_timestamptz(v_content->>'updated_at');
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
  RAISE EXCEPTION 'Safety Bin capture failed for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
END;
$$;

-- Tables without an explicit archived column use deletion retention; the Safety Bin
-- still preserves their pre-delete state and chain-of-custody record.
UPDATE public.lifecycle_policies
SET action='delete'
WHERE resource_type IN ('task_runs','research_sources','research_runs','reports','files');

CREATE OR REPLACE FUNCTION public.apply_phase_y_retention(p_limit integer DEFAULT 500)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; v_count integer := 0; v_cutoff timestamptz; v_sql text; v_changed integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Retention execution requires administrator authorization'; END IF;
  FOR p IN SELECT * FROM public.lifecycle_policies WHERE enabled ORDER BY resource_type LOOP
    v_cutoff := now() - make_interval(days => p.retention_days);
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=p.resource_type AND c.relkind='r') THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p.resource_type AND column_name='created_at') THEN CONTINUE; END IF;
    IF p.action='archive' AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p.resource_type AND column_name='archived') THEN
      v_sql := format('UPDATE public.%I SET archived=true WHERE created_at < $1 AND archived=false AND id IN (SELECT id FROM public.%I WHERE created_at < $1 AND archived=false LIMIT $2)', p.resource_type,p.resource_type);
    ELSE
      v_sql := format('DELETE FROM public.%I WHERE created_at < $1 AND id IN (SELECT id FROM public.%I WHERE created_at < $1 LIMIT $2)', p.resource_type,p.resource_type);
    END IF;
    EXECUTE v_sql USING v_cutoff,p_limit;
    GET DIAGNOSTICS v_changed=ROW_COUNT;
    v_count := v_count + v_changed;
  END LOOP;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_phase_y_retention(integer) TO authenticated, service_role;
