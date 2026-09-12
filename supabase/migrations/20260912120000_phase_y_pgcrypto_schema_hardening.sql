-- Phase Y hardening: Supabase installs pgcrypto in the extensions schema.
-- Keep Safety Bin integrity hashing resolvable under SECURITY DEFINER search_path.
CREATE OR REPLACE FUNCTION public.capture_deleted_row_to_safety_bin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
  v_hash := encode(extensions.digest(convert_to(v_content::text, 'UTF8'), 'sha256'), 'hex');
  INSERT INTO public.safety_bin_items(source_schema, source_table, source_object_id, source_owner_id, source_project_id, object_type, object_name, original_location, original_created_at, original_updated_at, deleted_by_id, deleted_by_email, deleted_at, content, content_hash, correlation_id)
  VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_object_id, v_owner, v_project, TG_TABLE_NAME, v_object_name, TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || COALESCE(':' || v_object_id, ''), v_created, v_updated, v_deleted_by, v_deleted_email, now(), v_content, v_hash, gen_random_uuid())
  RETURNING id INTO v_item;
  INSERT INTO public.safety_bin_versions(item_id, version, content, content_hash) VALUES (v_item, 1, v_content, v_hash);
  INSERT INTO public.safety_bin_events(item_id, actor_id, actor_email, action, details, correlation_id)
  SELECT v_item, v_deleted_by, v_deleted_email, 'deleted', jsonb_build_object('source_table', TG_TABLE_NAME, 'source_object_id', v_object_id), correlation_id
  FROM public.safety_bin_items WHERE id = v_item;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Safety Bin capture failed for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_safety_bin_integrity(p_item_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_content jsonb; v_hash text; v_expected text;
BEGIN
  SELECT content, content_hash INTO v_content, v_expected FROM public.safety_bin_items WHERE id = p_item_id;
  IF v_content IS NULL THEN RETURN false; END IF;
  v_hash := encode(extensions.digest(convert_to(v_content::text, 'UTF8'), 'sha256'), 'hex');
  RETURN v_hash = v_expected;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_safety_bin_integrity(uuid) TO authenticated, service_role;
