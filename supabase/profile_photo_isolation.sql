-- Shared INBETWEEN bucket: keep existing policies, but Ludia avatars are owner-only.
-- Restrictive SELECT combines with existing permissive policies using AND.
-- No rows or objects are changed. Other application paths retain their current access.
CREATE POLICY ludia_profile_owner_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (bucket_id <> 'profile-photos' OR split_part(name, '/', 2) <> 'ludia' OR split_part(name, '/', 1) = (SELECT auth.uid())::text);
