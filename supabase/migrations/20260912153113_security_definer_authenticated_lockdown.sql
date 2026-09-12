-- SECURITY DEFINER functions that are internal/admin/server operations are not exposed to authenticated clients.
revoke execute on function public.apply_phase_y_retention(integer) from public,anon,authenticated;
revoke execute on function public.claim_phase_n_step(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.complete_phase_n_step(uuid,text,jsonb,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke execute on function public.create_phase_n_orchestration_plan(uuid,uuid,text,jsonb,text,jsonb) from public,anon,authenticated;
revoke execute on function public.export_user_data(uuid) from public,anon,authenticated;
revoke execute on function public.freeze_safety_bin_item(uuid,boolean) from public,anon,authenticated;
revoke execute on function public.has_role(uuid,public.app_role) from public,anon,authenticated;
revoke execute on function public.process_user_deletion_request(uuid) from public,anon,authenticated;
revoke execute on function public.purge_safety_bin_item(uuid,text) from public,anon,authenticated;
revoke execute on function public.request_phase_n_gate(uuid,text,text,uuid) from public,anon,authenticated;
revoke execute on function public.restore_safety_bin_item(uuid) from public,anon,authenticated;
revoke execute on function public.verify_safety_bin_integrity(uuid) from public,anon,authenticated;
