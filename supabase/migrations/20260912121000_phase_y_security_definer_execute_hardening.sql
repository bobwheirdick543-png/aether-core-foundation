-- Phase Y security hardening: SECURITY DEFINER lifecycle functions must never be
-- anonymously callable through the public RPC surface.
REVOKE ALL ON FUNCTION public.capture_deleted_row_to_safety_bin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.safety_bin_actor_email(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_phase_y_retention(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.export_user_data(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_user_deletion_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_safety_bin_integrity(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_safety_bin_item(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_safety_bin_item(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.freeze_safety_bin_item(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_phase_y_retention(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.export_user_data(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_user_deletion_request(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_safety_bin_integrity(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_safety_bin_item(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_safety_bin_item(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.freeze_safety_bin_item(uuid, boolean) TO authenticated, service_role;
