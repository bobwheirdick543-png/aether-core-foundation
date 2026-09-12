-- Storage is outside the public schema, so it needs its own deletion boundary.
-- The preserved record contains the storage object identity and ownership metadata;
-- binary file preservation should be performed by the authenticated storage workflow
-- before deletion when the application owns the file lifecycle.
DROP TRIGGER IF EXISTS safety_bin_capture_delete_storage ON storage.objects;
CREATE TRIGGER safety_bin_capture_delete_storage
BEFORE DELETE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public.capture_deleted_row_to_safety_bin();
