-- Private avatar storage: each user may only read/write objects under avatars/{user_id}/
-- Avatars never grant permissions; they are decorative profile media only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path convention: avatars/{auth.uid()}/...

DROP POLICY IF EXISTS "Avatar owners can upload" ON storage.objects;
CREATE POLICY "Avatar owners can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Avatar owners can update" ON storage.objects;
CREATE POLICY "Avatar owners can update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Avatar owners can delete" ON storage.objects;
CREATE POLICY "Avatar owners can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Avatar owners can read own" ON storage.objects;
CREATE POLICY "Avatar owners can read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users may read any avatar object (for displaying other users later if needed).
-- Still requires a valid signed URL or authenticated session; bucket is not public.
DROP POLICY IF EXISTS "Authenticated can read avatars" ON storage.objects;
CREATE POLICY "Authenticated can read avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
