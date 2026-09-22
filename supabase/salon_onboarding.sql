-- LUDIA NAIL · first-owner onboarding · shared INBETWEEN project / ludia_* namespace
-- Run after supabase/salon_os.sql.
-- Creates the salon and the authenticated user's owner membership atomically,
-- avoiding any temporary RLS bypass in the client.

create or replace function public.ludia_create_salon_with_owner(
  salon_name text,
  owner_display_name text,
  salon_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_salon_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if nullif(trim(salon_name),'') is null then
    raise exception 'salon name required';
  end if;
  if nullif(trim(owner_display_name),'') is null then
    raise exception 'owner display name required';
  end if;

  insert into public.ludia_salons(name,phone)
  values(trim(salon_name),nullif(trim(salon_phone),''))
  returning id into new_salon_id;

  insert into public.ludia_salon_members(salon_id,user_id,role,display_name)
  values(new_salon_id,auth.uid(),'owner',trim(owner_display_name));

  return new_salon_id;
end;
$$;

revoke all on function public.ludia_create_salon_with_owner(text,text,text) from public, anon;
grant execute on function public.ludia_create_salon_with_owner(text,text,text) to authenticated;
