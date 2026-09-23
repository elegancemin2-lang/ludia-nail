-- LUDIA NAIL · Naver SmartPlace booking enrichment mapping
-- Apply after salon_os.sql and naver_bridge.sql.
-- Purpose: turn a normalized Naver reservation into a useful salon appointment without
-- storing Naver credentials or inventing customer/service/staff data.

create table if not exists public.ludia_naver_booking_mappings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  match_text text not null,
  service_id uuid references public.ludia_services(id) on delete cascade,
  staff_user_id uuid references auth.users(id) on delete set null,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 720),
  price integer check (price is null or price >= 0),
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(match_text)) >= 2),
  check (service_id is not null or staff_user_id is not null or duration_minutes is not null or price is not null),
  unique (salon_id, match_text)
);

create index if not exists ludia_naver_booking_mappings_lookup_idx
  on public.ludia_naver_booking_mappings(salon_id, is_active, priority, match_text);

alter table public.ludia_naver_booking_mappings enable row level security;

revoke all on table public.ludia_naver_booking_mappings from anon;
grant select, insert, update, delete on table public.ludia_naver_booking_mappings to authenticated;

create policy ludia_naver_booking_mappings_member_read
on public.ludia_naver_booking_mappings for select to authenticated
using (public.ludia_is_salon_member(salon_id));

create policy ludia_naver_booking_mappings_manager_write
on public.ludia_naver_booking_mappings for all to authenticated
using (public.ludia_is_salon_manager(salon_id))
with check (public.ludia_is_salon_manager(salon_id));

create or replace function public.ludia_touch_naver_booking_mapping() returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

do $$ begin
  create trigger ludia_naver_booking_mappings_touch
  before update on public.ludia_naver_booking_mappings
  for each row execute function public.ludia_touch_naver_booking_mapping();
exception when duplicate_object then null; end $$;

-- Enriches one Naver appointment from information that LUDIA can verify safely:
-- 1) exact normalized phone -> existing customer
-- 2) salon-managed text mapping -> service/staff/duration/price
-- Existing manual links win; the function only fills missing/default fields.
create or replace function public.ludia_enrich_naver_appointment(target_appointment uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.ludia_appointments%rowtype;
  ext public.ludia_external_bookings%rowtype;
  customer_match uuid;
  rule public.ludia_naver_booking_mappings%rowtype;
  svc public.ludia_services%rowtype;
  next_end timestamptz;
  next_price integer;
  next_service_name text;
begin
  select * into a
  from public.ludia_appointments
  where id=target_appointment
  for update;

  if not found then raise exception 'appointment not found'; end if;
  if a.source <> 'naver' then raise exception 'not a Naver appointment'; end if;
  if auth.role() <> 'service_role' and not public.ludia_is_salon_member(a.salon_id) then
    raise exception 'forbidden';
  end if;

  select * into ext
  from public.ludia_external_bookings
  where salon_id=a.salon_id and source='NAVER' and external_id=a.external_source_id
  limit 1;

  if not found then
    return jsonb_build_object('appointment_id',a.id,'enriched',false,'reason','external booking not found');
  end if;

  -- Phone matching is deterministic because salon_os.sql enforces one normalized phone per salon.
  if a.customer_id is null and nullif(regexp_replace(coalesce(ext.phone,''),'\D','','g'),'') is not null then
    select c.id into customer_match
    from public.ludia_customers c
    where c.salon_id=a.salon_id
      and c.phone_normalized=regexp_replace(ext.phone,'\D','','g')
    limit 1;
  end if;

  -- Rules are deliberately salon-managed. No fuzzy/AI guess is allowed here.
  select m.* into rule
  from public.ludia_naver_booking_mappings m
  where m.salon_id=a.salon_id
    and m.is_active
    and nullif(trim(m.match_text),'') is not null
    and strpos(lower(coalesce(ext.raw_text,'')),lower(m.match_text)) > 0
  order by m.priority asc, length(m.match_text) desc, m.created_at asc
  limit 1;

  if rule.service_id is not null then
    select * into svc from public.ludia_services
    where id=rule.service_id and salon_id=a.salon_id and is_active
    limit 1;
  end if;

  next_end := a.ends_at;
  if rule.duration_minutes is not null then
    next_end := a.starts_at + make_interval(mins=>rule.duration_minutes);
  elsif svc.id is not null and a.service_id is null then
    next_end := a.starts_at + make_interval(mins=>svc.duration_minutes);
  end if;

  next_price := a.price;
  if rule.price is not null then
    next_price := rule.price;
  elsif svc.id is not null and a.service_id is null and a.price=0 then
    next_price := svc.price;
  end if;

  next_service_name := a.service_name_snapshot;
  if svc.id is not null and a.service_id is null then
    next_service_name := svc.name;
  end if;

  update public.ludia_appointments
  set customer_id=coalesce(a.customer_id,customer_match),
      customer_name_snapshot=case
        when a.customer_id is null and customer_match is not null then
          coalesce((select c.name from public.ludia_customers c where c.id=customer_match),a.customer_name_snapshot)
        else a.customer_name_snapshot end,
      service_id=coalesce(a.service_id,svc.id),
      service_name_snapshot=next_service_name,
      staff_user_id=coalesce(a.staff_user_id,rule.staff_user_id),
      ends_at=next_end,
      price=next_price
  where id=a.id;

  return jsonb_build_object(
    'appointment_id',a.id,
    'enriched',customer_match is not null or rule.id is not null,
    'customer_matched',customer_match is not null,
    'mapping_id',rule.id,
    'service_id',coalesce(a.service_id,svc.id),
    'staff_user_id',coalesce(a.staff_user_id,rule.staff_user_id),
    'duration_minutes',extract(epoch from (next_end-a.starts_at))/60,
    'price',next_price
  );
end
$$;

revoke all on function public.ludia_enrich_naver_appointment(uuid) from public,anon;
grant execute on function public.ludia_enrich_naver_appointment(uuid) to authenticated,service_role;

-- The bridge writes ludia_external_bookings before projecting the appointment, so this trigger
-- can safely enrich each new/changed Naver reservation after the projection finishes.
create or replace function public.ludia_auto_enrich_naver_appointment() returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.source='naver' and new.external_source_id is not null then
    perform public.ludia_enrich_naver_appointment(new.id);
  end if;
  return new;
end
$$;

do $$ begin
  create trigger ludia_naver_appointment_auto_enrich
  after insert or update of external_source_id, customer_phone_snapshot, starts_at, status
  on public.ludia_appointments
  for each row
  when (new.source='naver')
  execute function public.ludia_auto_enrich_naver_appointment();
exception when duplicate_object then null; end $$;

-- Manual setup remains intentionally small:
-- owners/managers create mapping rows such as match_text='젤 원컬러' -> service_id=<LUDIA service>.
-- No Naver password, cookie, storageState, browser profile, CAPTCHA bypass, or credential material belongs in Supabase.
