-- Phase Y follow-up: operational wiring that depends on the core Safety Bin schema.

INSERT INTO public.agents(agent_key,name,description,purpose,status,tools)
VALUES (
  'recycling',
  'Recycling Agent',
  'Maintains the independent Aether Safety Bin ecosystem, preserves deletion evidence, supports recovery and produces governed evidence reports.',
  'Operate Safety Bin search, integrity, recovery and reporting without bypassing Phase X authorization.',
  'enabled',
  ARRAY['safety_bin.read','safety_bin.search','safety_bin.integrity','safety_bin.restore','safety_bin.report','safety_bin.freeze']
)
ON CONFLICT (agent_key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, purpose=EXCLUDED.purpose, tools=EXCLUDED.tools;

INSERT INTO public.agent_permissions(agent_id,permission,allowed,requires_approval)
SELECT a.id,p.permission,p.allowed,p.requires_approval
FROM public.agents a
CROSS JOIN (VALUES
 ('safety_bin.read',true,false),
 ('safety_bin.search',true,false),
 ('safety_bin.integrity',true,false),
 ('safety_bin.restore',true,false),
 ('safety_bin.report',true,false),
 ('safety_bin.freeze',true,true),
 ('safety_bin.purge',false,true),
 ('roles.modify',false,true),
 ('permissions.self_modify',false,true)
) AS p(permission,allowed,requires_approval)
WHERE a.agent_key='recycling'
ON CONFLICT (agent_id,permission) DO UPDATE SET allowed=EXCLUDED.allowed, requires_approval=EXCLUDED.requires_approval;

-- Storage is private. Users can only create/read objects in their own UUID folder;
-- administrators can operate across folders. Signed URLs remain short-lived.
DROP POLICY IF EXISTS "Safety Bin reports insert" ON storage.objects;
CREATE POLICY "Safety Bin reports insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='aether-safety-bin-reports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS "Safety Bin reports read" ON storage.objects;
CREATE POLICY "Safety Bin reports read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='aether-safety-bin-reports'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
);
DROP POLICY IF EXISTS "Safety Bin reports delete" ON storage.objects;
CREATE POLICY "Safety Bin reports delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='aether-safety-bin-reports'
  AND public.has_role(auth.uid(),'admin')
);

-- A deterministic export function covers user-owned rows without exposing a service role to the browser.
CREATE OR REPLACE FUNCTION public.export_user_data(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  r record;
  v_rows jsonb;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF v_actor IS NULL OR p_user_id IS NULL OR (v_actor <> p_user_id AND NOT public.has_role(v_actor,'admin')) THEN
    RAISE EXCEPTION 'User data export is not authorized';
  END IF;

  FOR r IN
    SELECT table_name,
      CASE WHEN bool_or(column_name='owner_id') THEN 'owner_id'
           WHEN bool_or(column_name='user_id') THEN 'user_id'
           WHEN bool_or(column_name='recipient_id') THEN 'recipient_id'
           ELSE NULL END AS actor_column
    FROM information_schema.columns
    WHERE table_schema='public'
      AND column_name IN ('owner_id','user_id','recipient_id')
      AND table_name NOT LIKE 'safety_bin_%'
      AND table_name <> 'user_lifecycle_requests'
    GROUP BY table_name
    HAVING bool_or(column_name IN ('owner_id','user_id','recipient_id'))
  LOOP
    IF r.actor_column IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM (SELECT * FROM public.%I WHERE %I=$1 LIMIT 10000) x', r.table_name, r.actor_column)
        INTO v_rows USING p_user_id;
      IF v_rows <> '[]'::jsonb THEN v_result := v_result || jsonb_build_object(r.table_name, v_rows); END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(v_result || jsonb_build_object('profiles', jsonb_build_array(to_jsonb(p))), v_result)
  INTO v_result
  FROM public.profiles p WHERE p.id=p_user_id;

  RETURN jsonb_build_object('user_id',p_user_id,'generated_at',now(),'source','Aether Data Export','data',v_result);
END;
$$;
GRANT EXECUTE ON FUNCTION public.export_user_data(uuid) TO authenticated;

-- Admin-approved account deletion: deleting auth.users cascades through the application,
-- while Phase Y BEFORE DELETE triggers preserve each public row in the Safety Bin first.
CREATE OR REPLACE FUNCTION public.process_user_deletion_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_request public.user_lifecycle_requests;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin') THEN RAISE EXCEPTION 'User deletion requires administrator authorization'; END IF;
  SELECT * INTO v_request FROM public.user_lifecycle_requests WHERE id=p_request_id AND request_type='deletion' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'message','Deletion request not found'); END IF;
  IF v_request.status NOT IN ('requested','approved') THEN RETURN jsonb_build_object('ok',false,'message','Deletion request is not actionable','status',v_request.status); END IF;

  UPDATE public.user_lifecycle_requests SET status='processing' WHERE id=p_request_id;
  BEGIN
    DELETE FROM auth.users WHERE id=v_request.user_id;
    UPDATE public.user_lifecycle_requests SET status='completed', completed_at=now(), error_message=NULL WHERE id=p_request_id;
    RETURN jsonb_build_object('ok',true,'status','completed','user_id',v_request.user_id);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.user_lifecycle_requests SET status='failed', error_message=left(SQLERRM,1000) WHERE id=p_request_id;
    RETURN jsonb_build_object('ok',false,'status','failed','message','User deletion failed');
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.process_user_deletion_request(uuid) TO authenticated;

-- Admin can run lifecycle retention; all hard deletes still pass through Safety Bin capture.
COMMENT ON FUNCTION public.apply_phase_y_retention(integer) IS 'Phase Y lifecycle retention. Source deletion is preserved by the Safety Bin boundary.';
