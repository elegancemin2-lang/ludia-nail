-- Save a menu edit and its numbered snapshot in one RLS-protected transaction.
-- Uses the existing project/snapshot constraints; monthly/favorite are UI state.
CREATE OR REPLACE FUNCTION public.ludia_save_art_revision(
  p_salon_id uuid, p_project_id uuid, p_title text, p_menu_status text,
  p_tags text[], p_design_json jsonb, p_preview_path text DEFAULT NULL,
  p_replace_photo boolean DEFAULT false
) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  previous public.ludia_art_design_snapshots%rowtype;
  revision integer;
  meta jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.ludia_is_salon_member(p_salon_id) THEN
    RAISE EXCEPTION 'salon authentication required' USING ERRCODE='42501';
  END IF;
  IF nullif(trim(p_title),'') IS NULL OR p_menu_status NOT IN ('draft','favorite','monthly') THEN
    RAISE EXCEPTION 'invalid art metadata';
  END IF;
  PERFORM 1 FROM public.ludia_art_projects WHERE id=p_project_id AND salon_id=p_salon_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'art project unavailable' USING ERRCODE='42501'; END IF;
  IF p_preview_path IS NOT NULL AND split_part(p_preview_path,'/',1)<>p_salon_id::text THEN
    RAISE EXCEPTION 'invalid art photo path' USING ERRCODE='42501';
  END IF;
  SELECT * INTO previous FROM public.ludia_art_design_snapshots
    WHERE project_id=p_project_id ORDER BY version_no DESC LIMIT 1;
  revision:=coalesce(previous.version_no,0)+1;
  meta:=coalesce(previous.design_json,'{}'::jsonb)||coalesce(p_design_json,'{}'::jsonb)
    ||jsonb_build_object('menuStatus',p_menu_status);
  IF p_design_json->'designState'='null'::jsonb AND previous.design_json ? 'designState' THEN
    meta:=jsonb_set(meta,'{designState}',previous.design_json->'designState');
  END IF;
  UPDATE public.ludia_art_projects SET title=trim(p_title),tags=coalesce(p_tags,'{}'::text[]),
    purpose=CASE WHEN p_menu_status='monthly' THEN 'monthly_art' ELSE 'internal' END,
    status=CASE WHEN p_menu_status='draft' THEN 'draft' ELSE 'confirmed' END
    WHERE id=p_project_id AND salon_id=p_salon_id;
  INSERT INTO public.ludia_art_design_snapshots(project_id,version_no,source_type,design_json,
    preview_image_url,render_status,estimated_price,estimated_duration_min)
  VALUES(p_project_id,revision,'manual',meta,
    CASE WHEN p_replace_photo THEN p_preview_path ELSE previous.preview_image_url END,
    'completed',nullif((meta->>'price')::integer,0),nullif((meta->>'time')::integer,0));
  RETURN revision;
END;
$$;
REVOKE ALL ON FUNCTION public.ludia_save_art_revision(uuid,uuid,text,text,text[],jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ludia_save_art_revision(uuid,uuid,text,text,text[],jsonb,text,boolean) TO authenticated;
