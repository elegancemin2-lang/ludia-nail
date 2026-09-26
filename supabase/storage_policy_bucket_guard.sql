-- Shared Storage policies must not read another product's protected tables
-- while authorizing a LUDIA bucket. Preserve the existing Sitefit predicates
-- and caller privileges; do not add table grants or SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.ludia_storage_sitefit_policy_allows(
  p_bucket text, p_name text, p_allow_operator boolean
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
  IF p_bucket IS DISTINCT FROM 'sitefit-media' THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.sitefit_sites s
    WHERE s.slug=(storage.foldername(p_name))[1]
      AND s.manage_token_hash=encode(extensions.digest(coalesce(
        current_setting('request.headers',true)::jsonb->>'x-sitefit-key',''), 'sha256'),'hex')
  ) OR (p_allow_operator AND EXISTS (
    SELECT 1 FROM public.sitefit_config c
    WHERE c.id=true AND c.operator_key_hash=encode(extensions.digest(coalesce(
      current_setting('request.headers',true)::jsonb->>'x-sitefit-operator',''), 'sha256'),'hex')
  ));
END;
$$;
REVOKE ALL ON FUNCTION public.ludia_storage_sitefit_policy_allows(text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ludia_storage_sitefit_policy_allows(text,text,boolean) TO anon,authenticated;
ALTER POLICY "sitefit media metadata by site key" ON storage.objects
  USING (public.ludia_storage_sitefit_policy_allows(bucket_id,name,true));
ALTER POLICY "sitefit upload by site key" ON storage.objects
  WITH CHECK (public.ludia_storage_sitefit_policy_allows(bucket_id,name,true));
ALTER POLICY "sitefit update media by site key" ON storage.objects
  USING (public.ludia_storage_sitefit_policy_allows(bucket_id,name,false))
  WITH CHECK (public.ludia_storage_sitefit_policy_allows(bucket_id,name,false));
