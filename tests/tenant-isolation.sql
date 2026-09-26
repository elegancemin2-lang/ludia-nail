-- Run only through an administrative SQL connection. All fixtures roll back.
-- This checks Postgres RLS, not browser sign-in or Storage HTTP/signed URLs.
BEGIN;
DO $qa$
DECLARE
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid();
  sa uuid := gen_random_uuid(); sb uuid := gen_random_uuid();
  pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid();
  affected integer;
BEGIN
  INSERT INTO auth.users(id) VALUES(ua),(ub);
  INSERT INTO public.ludia_salons(id,name) VALUES(sa,'QA rollback A'),(sb,'QA rollback B');
  INSERT INTO public.ludia_salon_members(salon_id,user_id,role,display_name)
    VALUES(sa,ua,'owner','QA A'),(sb,ub,'owner','QA B');
  INSERT INTO public.ludia_customers(salon_id,name) VALUES(sa,'QA A'),(sb,'QA B');
  INSERT INTO public.ludia_appointments(salon_id,customer_name_snapshot,service_name_snapshot,starts_at,ends_at)
    VALUES(sa,'QA A','QA',now(),now()+interval '1 hour'),(sb,'QA B','QA',now(),now()+interval '1 hour');
  INSERT INTO public.ludia_art_projects(id,salon_id,title) VALUES(pa,sa,'QA A'),(pb,sb,'QA B');
  INSERT INTO public.ludia_art_design_snapshots(project_id) VALUES(pa),(pb);
  INSERT INTO storage.objects(bucket_id,name,owner_id)
    VALUES('ludia-art',sa::text||'/qa-rollback.png',ua::text),('ludia-art',sb::text||'/qa-rollback.png',ub::text),
      ('profile-photos',ua::text||'/ludia/qa-rollback.png',ua::text),('profile-photos',ub::text||'/ludia/qa-rollback.png',ub::text);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ua,'role','authenticated')::text,true);
  SET LOCAL ROLE authenticated;
  IF auth.uid() <> ua THEN RAISE EXCEPTION 'test identity not applied'; END IF;
  IF (SELECT count(*) FROM public.ludia_customers WHERE salon_id=sa)<>1
    OR EXISTS(SELECT 1 FROM public.ludia_customers WHERE salon_id=sb)
    OR EXISTS(SELECT 1 FROM public.ludia_appointments WHERE salon_id=sb)
    OR EXISTS(SELECT 1 FROM public.ludia_art_projects WHERE salon_id=sb)
    OR EXISTS(SELECT 1 FROM public.ludia_art_design_snapshots WHERE project_id=pb)
    THEN RAISE EXCEPTION 'cross-salon SELECT failed'; END IF;
  IF (SELECT count(*) FROM storage.objects WHERE name IN(sa::text||'/qa-rollback.png',ua::text||'/ludia/qa-rollback.png'))<>2
    OR EXISTS(SELECT 1 FROM storage.objects WHERE name IN(sb::text||'/qa-rollback.png',ub::text||'/ludia/qa-rollback.png'))
    THEN RAISE EXCEPTION 'private object isolation failed'; END IF;
  INSERT INTO public.ludia_customers(salon_id,name) VALUES(sa,'QA own write');
  BEGIN
    INSERT INTO public.ludia_customers(salon_id,name) VALUES(sb,'QA forbidden');
    RAISE EXCEPTION 'cross-salon INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.ludia_customers SET salon_id=sb WHERE salon_id=sa;
    RAISE EXCEPTION 'cross-salon reassignment was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.ludia_customers SET name='QA forbidden' WHERE salon_id=sb;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'cross-salon UPDATE was allowed'; END IF;
  DELETE FROM public.ludia_art_projects WHERE id=pb;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected<>0 THEN RAISE EXCEPTION 'cross-salon DELETE was allowed'; END IF;
  BEGIN
    INSERT INTO public.ludia_art_design_snapshots(project_id,version_no) VALUES(pb,2);
    RAISE EXCEPTION 'cross-salon snapshot INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('ludia-art',sb::text||'/qa-forbidden.png',ua::text);
    RAISE EXCEPTION 'cross-salon Storage INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',ub,'role','authenticated')::text,true);
  IF (SELECT count(*) FROM public.ludia_customers WHERE salon_id=sb)<>1
    OR EXISTS(SELECT 1 FROM public.ludia_art_projects WHERE salon_id=sa)
    OR EXISTS(SELECT 1 FROM storage.objects WHERE name IN(sa::text||'/qa-rollback.png',ua::text||'/ludia/qa-rollback.png'))
    THEN RAISE EXCEPTION 'reverse tenant isolation failed'; END IF;
  RESET ROLE;
END $qa$;
ROLLBACK;
SELECT 'PASS: tenant SELECT/INSERT/UPDATE/DELETE, snapshots and private Storage metadata; fixtures rolled back' AS result;
