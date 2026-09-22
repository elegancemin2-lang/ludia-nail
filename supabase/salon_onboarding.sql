-- LUDIA NAIL · first-owner onboarding · shared INBETWEEN project / ludia_* namespace
-- Creates the salon, owner membership, and a practical starter service menu atomically.

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

  insert into public.ludia_services(salon_id,name,category,duration_minutes,price,sort_order)
  values
    (new_salon_id,'젤 원컬러','네일',60,45000,10),
    (new_salon_id,'젤 아트','네일',90,79000,20),
    (new_salon_id,'이달의 아트','네일',90,79000,30),
    (new_salon_id,'오마카세 아트','네일',120,99000,40),
    (new_salon_id,'제거 + 젤 아트','네일',120,89000,50);

  return new_salon_id;
end;
$$;

revoke all on function public.ludia_create_salon_with_owner(text,text,text) from public, anon;
grant execute on function public.ludia_create_salon_with_owner(text,text,text) to authenticated;
