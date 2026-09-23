-- LUDIA NAIL · native booking slot availability
-- Apply after staff_availability.sql.
-- Returns one salon-local day of bookable slots with explicit block reasons so the
-- booking sheet can gray unavailable times before submit. DB trigger remains final authority.

create or replace function public.ludia_staff_day_slots(
  p_salon_id uuid,
  p_staff_user_id uuid,
  p_local_date date,
  p_duration_minutes integer default 60,
  p_step_minutes integer default 30
)
returns table(slot_start timestamptz, slot_end timestamptz, available boolean, reason text)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_timezone text := 'Asia/Seoul';
  v_rule public.ludia_staff_work_rules%rowtype;
  v_open time := time '09:00';
  v_close time := time '21:00';
  v_local_start timestamp;
  v_local_end timestamp;
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if not public.ludia_is_salon_member(p_salon_id) then
    raise exception 'not authorized';
  end if;
  if p_local_date is null or p_duration_minutes < 5 or p_duration_minutes > 480 or p_step_minutes < 5 or p_step_minutes > 120 then
    raise exception 'invalid slot request';
  end if;

  select coalesce(s.timezone,'Asia/Seoul') into v_timezone
  from public.ludia_salons s where s.id=p_salon_id;

  if not exists (
    select 1 from public.ludia_salon_members m
    where m.salon_id=p_salon_id and m.user_id=p_staff_user_id and m.is_active
  ) then
    return query select null::timestamptz,null::timestamptz,false,'inactive_staff'::text;
    return;
  end if;

  select * into v_rule
  from public.ludia_staff_work_rules r
  where r.salon_id=p_salon_id and r.staff_user_id=p_staff_user_id
    and r.weekday=extract(dow from p_local_date)::smallint;

  -- Legacy salons without a configured weekday retain the existing open-scheduling window.
  if found then
    if not v_rule.is_working or v_rule.starts_at is null or v_rule.ends_at is null then
      return query select null::timestamptz,null::timestamptz,false,'outside_work_hours'::text;
      return;
    end if;
    v_open:=v_rule.starts_at;
    v_close:=v_rule.ends_at;
  end if;

  v_local_start:=p_local_date+v_open;
  while v_local_start + make_interval(mins=>p_duration_minutes) <= p_local_date+v_close loop
    v_local_end:=v_local_start+make_interval(mins=>p_duration_minutes);
    v_start:=v_local_start at time zone v_timezone;
    v_end:=v_local_end at time zone v_timezone;

    select public.ludia_staff_availability(p_salon_id,p_staff_user_id,v_start,v_end,null) into v_result;
    slot_start:=v_start;
    slot_end:=v_end;
    available:=coalesce((v_result->>'available')::boolean,false);
    reason:=v_result->>'reason';
    return next;

    v_local_start:=v_local_start+make_interval(mins=>p_step_minutes);
  end loop;
end $$;

revoke all on function public.ludia_staff_day_slots(uuid,uuid,date,integer,integer) from public,anon;
grant execute on function public.ludia_staff_day_slots(uuid,uuid,date,integer,integer) to authenticated;

comment on function public.ludia_staff_day_slots(uuid,uuid,date,integer,integer) is
'Booking-sheet preflight slots. Reasons: outside_work_hours, time_off, appointment_conflict, inactive_staff. Appointment trigger is authoritative.';
