-- Applied on INBETWEEN 2026-10-06. Additive changes; keep existing rows, RLS and member RPCs.
alter table public.ludia_booking_sync_events add column if not exists event_key text;
create unique index if not exists ludia_booking_sync_events_event_key_idx on public.ludia_booking_sync_events(salon_id,source,event_key) where event_key is not null;
CREATE OR REPLACE FUNCTION public.ludia_enrich_naver_appointment(target_appointment uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.ludia_appointments%rowtype;
  ext public.ludia_external_bookings%rowtype;
  customer_match uuid;
  rule public.ludia_naver_booking_mappings%rowtype;
  svc public.ludia_services%rowtype;
  staff_match uuid;
  next_staff uuid;
  mapping_pending boolean:=false;
  availability jsonb;
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

  -- Staff/service come only from explicit salon mappings, never raw-text name guesses.

  next_end := a.ends_at;
  if rule.duration_minutes is not null and a.service_id is null and a.ends_at-a.starts_at=interval '90 minutes' and coalesce(a.memo,'') not like 'LUDIA_META:%' then
    next_end := a.starts_at + make_interval(mins=>rule.duration_minutes);
  elsif svc.id is not null and a.service_id is null and coalesce(a.memo,'') not like 'LUDIA_META:%' then
    next_end := a.starts_at + make_interval(mins=>svc.duration_minutes);
  end if;

  next_price := a.price;
  if rule.price is not null and a.price=0 and coalesce(a.memo,'') not like 'LUDIA_META:%' then
    next_price := rule.price;
  elsif svc.id is not null and a.service_id is null and a.price=0 then
    next_price := svc.price;
  end if;

  next_service_name := a.service_name_snapshot;
  if svc.id is not null and a.service_id is null then
    next_service_name := svc.name;
  end if;

  next_staff:=coalesce(a.staff_user_id,rule.staff_user_id);
  if next_staff is not null and a.status not in ('cancelled','no_show') and (a.staff_user_id is distinct from next_staff or a.ends_at is distinct from next_end) then
    perform pg_advisory_xact_lock(hashtextextended(a.salon_id::text||':staff:'||next_staff::text,0));
    availability:=public.ludia_staff_availability(a.salon_id,next_staff,a.starts_at,next_end,a.id);
    if not coalesce((availability->>'available')::boolean,false) then
      next_staff:=a.staff_user_id;next_end:=a.ends_at;mapping_pending:=true;
    end if;
  end if;

  update public.ludia_appointments
  set customer_id=coalesce(a.customer_id,customer_match),
      customer_name_snapshot=case
        when a.customer_id is null and customer_match is not null then
          coalesce((select c.name from public.ludia_customers c where c.id=customer_match),a.customer_name_snapshot)
        else a.customer_name_snapshot end,
      service_id=coalesce(a.service_id,svc.id),
      service_name_snapshot=next_service_name,
      staff_user_id=next_staff,
      ends_at=next_end,
      price=next_price
  where id=a.id;

  return jsonb_build_object(
    'appointment_id',a.id,
    'enriched',customer_match is not null or rule.id is not null or svc.id is not null or staff_match is not null,
    'customer_matched',customer_match is not null,
    'mapping_pending',mapping_pending,
    'mapping_id',rule.id,
    'service_id',coalesce(a.service_id,svc.id),
    'staff_user_id',next_staff,
    'duration_minutes',extract(epoch from (next_end-a.starts_at))/60,
    'price',next_price
  );
end
$function$;
CREATE OR REPLACE FUNCTION public.ludia_guard_appointment_staff_availability()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_timezone text := 'Asia/Seoul'; v_local_start timestamp; v_local_end timestamp; v_rule public.ludia_staff_work_rules%rowtype; begin if new.staff_user_id is null or new.status in ('cancelled','no_show') then return new; end if; if tg_op='UPDATE' and new.staff_user_id is not distinct from old.staff_user_id and new.starts_at is not distinct from old.starts_at and new.ends_at is not distinct from old.ends_at then return new; end if; perform pg_advisory_xact_lock(hashtextextended(new.salon_id::text||':staff:'||new.staff_user_id::text,0)); if not exists(select 1 from public.ludia_salon_members m where m.salon_id=new.salon_id and m.user_id=new.staff_user_id and m.is_active) then raise exception using message='LUDIA_AVAILABILITY:inactive_staff',errcode='P0001'; end if; select coalesce(timezone,'Asia/Seoul') into v_timezone from public.ludia_salons where id=new.salon_id; v_local_start:=new.starts_at at time zone v_timezone; v_local_end:=new.ends_at at time zone v_timezone; if v_local_start::date<>v_local_end::date then raise exception using message='LUDIA_AVAILABILITY:outside_work_hours',errcode='P0001'; end if; select * into v_rule from public.ludia_staff_work_rules where salon_id=new.salon_id and staff_user_id=new.staff_user_id and weekday=extract(dow from v_local_start)::smallint; if found and (not v_rule.is_working or v_rule.starts_at is null or v_rule.ends_at is null or v_local_start::time<v_rule.starts_at or v_local_end::time>v_rule.ends_at) then raise exception using message='LUDIA_AVAILABILITY:outside_work_hours',errcode='P0001'; end if; if exists(select 1 from public.ludia_staff_time_off t where t.salon_id=new.salon_id and t.staff_user_id=new.staff_user_id and t.starts_at<new.ends_at and t.ends_at>new.starts_at) then raise exception using message='LUDIA_AVAILABILITY:time_off',errcode='P0001'; end if; if exists(select 1 from public.ludia_appointments a where a.salon_id=new.salon_id and a.staff_user_id=new.staff_user_id and a.status not in ('cancelled','no_show') and a.id<>new.id and a.starts_at<new.ends_at and a.ends_at>new.starts_at) then raise exception using message='LUDIA_AVAILABILITY:appointment_conflict',errcode='P0001'; end if; return new; end $function$;
CREATE OR REPLACE FUNCTION public.ludia_ingest_naver_bridge_event(p_salon_id uuid, p_event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid; v_key text:=p_event->>'event_key';
begin
 if current_user not in ('service_role','postgres') then raise exception 'server role required'; end if;
 if p_salon_id is null or not exists(select 1 from public.ludia_salons where id=p_salon_id) then raise exception 'salon unavailable'; end if;
 if v_key is null or v_key !~ '^[a-f0-9]{64}$' or p_event->>'source'<>'NAVER' then raise exception 'invalid bridge event'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_salon_id::text||':naver:'||(p_event->>'external_id'),0));
 if exists(select 1 from public.ludia_booking_sync_events where salon_id=p_salon_id and source='NAVER' and event_key=v_key) then
  return jsonb_build_object('ok',true,'deduplicated',true);
 end if;
 insert into public.ludia_external_bookings(salon_id,source,external_id,booking_no,booking_date,booking_time,phone,status,raw_text,last_synced_at)
 values(p_salon_id,'NAVER',p_event->>'external_id',p_event->>'booking_no',p_event->>'booking_date',p_event->>'booking_time',p_event->>'phone',p_event->>'status',p_event->>'raw_text',now())
 on conflict(salon_id,source,external_id) do update set booking_no=excluded.booking_no,booking_date=excluded.booking_date,booking_time=excluded.booking_time,phone=excluded.phone,status=excluded.status,raw_text=excluded.raw_text,last_synced_at=now();
 v_id:=public.ludia_sync_naver_booking_to_appointment(p_salon_id,p_event->>'external_id',p_event->>'booking_no',p_event->>'booking_date',p_event->>'booking_time',p_event->>'phone',p_event->>'status',p_event->>'raw_text');
 if v_id is null then raise exception 'booking projection rejected'; end if;
 insert into public.ludia_booking_sync_events(salon_id,source,event_key,event_type,external_id,booking_no,booking_date,booking_time,phone,status,raw_text)
 values(p_salon_id,'NAVER',v_key,p_event->>'event_type',p_event->>'external_id',p_event->>'booking_no',p_event->>'booking_date',p_event->>'booking_time',p_event->>'phone',p_event->>'status',p_event->>'raw_text');
 return jsonb_build_object('ok',true,'appointmentId',v_id);
end $function$;
CREATE OR REPLACE FUNCTION public.ludia_resolve_naver_conflict_scoped(p_salon_id uuid, p_conflict_id bigint, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_conflict public.ludia_naver_sync_conflicts%rowtype; v_appt public.ludia_appointments%rowtype; v_resolution text;
begin
 if current_user not in ('service_role','postgres') then raise exception 'server role required'; end if;
 if p_action not in ('keep_ludia','accept_naver') then raise exception 'invalid resolution action'; end if;
 select * into v_conflict from public.ludia_naver_sync_conflicts where id=p_conflict_id and salon_id=p_salon_id for update;
 if not found then raise exception 'conflict unavailable'; end if;
 if v_conflict.resolved_at is not null then return jsonb_build_object('ok',true,'alreadyResolved',true); end if;
 select * into v_appt from public.ludia_appointments where id=v_conflict.appointment_id and salon_id=p_salon_id for update;
 if not found then raise exception 'appointment unavailable'; end if;
 if p_action='accept_naver' then
  if v_appt.status in ('cancelled','completed','no_show') or v_conflict.requested_ends_at<=v_conflict.requested_starts_at then raise exception 'appointment no longer movable'; end if;
  if v_appt.staff_user_id is not null then
   perform pg_advisory_xact_lock(hashtextextended(p_salon_id::text||':staff:'||v_appt.staff_user_id::text,0));
   if exists(select 1 from public.ludia_appointments a where a.salon_id=p_salon_id and a.id<>v_appt.id and a.staff_user_id=v_appt.staff_user_id and a.status not in ('cancelled','no_show') and a.starts_at<v_conflict.requested_ends_at and a.ends_at>v_conflict.requested_starts_at) then raise exception 'requested time still conflicts'; end if;
  end if;
  update public.ludia_appointments set starts_at=v_conflict.requested_starts_at,ends_at=v_conflict.requested_ends_at,source_updated_at=now() where id=v_appt.id and salon_id=p_salon_id;
  v_resolution:='accepted_naver';
 else v_resolution:='kept_ludia'; end if;
 update public.ludia_naver_sync_conflicts set resolved_at=now(),resolution=v_resolution where id=v_conflict.id and salon_id=p_salon_id;
 return jsonb_build_object('ok',true,'resolution',v_resolution);
end $function$;
CREATE OR REPLACE FUNCTION public.ludia_sync_naver_booking_to_appointment(p_salon_id uuid, p_external_id text, p_booking_no text, p_booking_date text, p_booking_time text, p_phone text, p_status text, p_raw_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_status text;
  v_label text;
  v_current public.ludia_appointments%rowtype;
  v_conflict uuid;
begin
  if p_salon_id is null or nullif(trim(p_external_id),'') is null then
    raise exception 'salon_id and external_id are required';
  end if;
  if p_booking_date is null or p_booking_time is null then return null; end if;

  begin
    v_start := ((p_booking_date::date + p_booking_time::time) at time zone 'Asia/Seoul');
  exception when others then
    return null;
  end;

  v_status := case p_status
    when 'cancelled' then 'cancelled'
    when 'completed' then 'completed'
    when 'no_show' then 'no_show'
    when 'requested' then 'pending'
    else 'confirmed'
  end;
  v_label := case when nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),'') is not null
    then '네이버 예약 · ' || right(regexp_replace(p_phone,'\D','','g'),4)
    else '네이버 예약' end;

  select * into v_current
  from public.ludia_appointments
  where salon_id=p_salon_id and source='naver' and external_source_id=p_external_id
  limit 1 for update;

  if not found then
    insert into public.ludia_appointments(
      salon_id,source,external_source_id,customer_name_snapshot,customer_phone_snapshot,
      service_name_snapshot,starts_at,ends_at,status,price,memo,source_updated_at
    ) values (
      p_salon_id,'naver',p_external_id,v_label,nullif(p_phone,''),'네이버 예약',
      v_start,v_start+interval '90 minutes',v_status,0,
      case when p_booking_no is not null then '네이버 예약번호 '||p_booking_no else '' end,now()
    ) returning id into v_id;
    return v_id;
  end if;

  v_id := v_current.id;
  v_end := v_start + greatest(interval '5 minutes',v_current.ends_at-v_current.starts_at);

  -- Only guard active time moves with a known staff assignment. Cancellation/completion/no-show
  -- must still flow through even if the old slot overlaps something else.
  if v_current.staff_user_id is not null
     and v_status in ('pending','confirmed')
     and v_start is distinct from v_current.starts_at then
    perform pg_advisory_xact_lock(hashtextextended(p_salon_id::text||':staff:'||v_current.staff_user_id::text,0));
    select a.id into v_conflict
    from public.ludia_appointments a
    where a.salon_id=p_salon_id
      and a.id<>v_current.id
      and a.staff_user_id=v_current.staff_user_id
      and a.status not in ('cancelled','no_show')
      and a.starts_at < v_end
      and a.ends_at > v_start
    order by a.starts_at
    limit 1;
  end if;

  if v_conflict is not null then
    -- De-duplicate repeated bridge polls for the same unresolved requested move.
    if not exists (
      select 1 from public.ludia_naver_sync_conflicts c
      where c.appointment_id=v_current.id
        and c.conflicting_appointment_id=v_conflict
        and c.requested_starts_at=v_start
        and c.requested_ends_at=v_end
        and c.resolved_at is null
    ) then
      insert into public.ludia_naver_sync_conflicts(
        salon_id,appointment_id,conflicting_appointment_id,external_id,
        requested_starts_at,requested_ends_at
      ) values (p_salon_id,v_current.id,v_conflict,p_external_id,v_start,v_end);
    end if;

    -- Preserve the LUDIA slot. Non-time metadata/status is still refreshed so the bridge does
    -- not become stale while the owner resolves the scheduling conflict.
    update public.ludia_appointments
    set customer_phone_snapshot=coalesce(nullif(p_phone,''),customer_phone_snapshot),
        customer_name_snapshot=case when customer_id is null then v_label else customer_name_snapshot end,
        status=v_status,
        memo=memo,
        source_updated_at=now()
    where id=v_current.id;
    return v_current.id;
  end if;

  update public.ludia_appointments
  set starts_at=v_start,
      ends_at=v_end,
      customer_phone_snapshot=coalesce(nullif(p_phone,''),customer_phone_snapshot),
      customer_name_snapshot=case when customer_id is null then v_label else customer_name_snapshot end,
      status=v_status,
      memo=memo,
      source_updated_at=now()
  where id=v_current.id;

  return v_current.id;
end;
$function$;
revoke all on function public.ludia_ingest_naver_bridge_event(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ludia_ingest_naver_bridge_event(uuid,jsonb) to service_role;

revoke all on function public.ludia_resolve_naver_conflict_scoped(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.ludia_resolve_naver_conflict_scoped(uuid,bigint,text) to service_role;

