-- LUDIA NAIL · staff availability guard
-- Apply after salon_os.sql and staff_operations.sql.
-- Keeps manual/Naver/API writes consistent at the database boundary.

create or replace function public.ludia_staff_availability(p_salon_id uuid,p_staff_user_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_exclude_appointment_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_timezone text := 'Asia/Seoul'; v_local_start timestamp; v_local_end timestamp; v_rule public.ludia_staff_work_rules%rowtype;
begin
 if not public.ludia_is_salon_member(p_salon_id) then raise exception 'not authorized'; end if;
 if p_staff_user_id is null or p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at then return jsonb_build_object('available',false,'reason','invalid_time'); end if;
 select coalesce(timezone,'Asia/Seoul') into v_timezone from public.ludia_salons where id=p_salon_id;
 if not exists(select 1 from public.ludia_salon_members where salon_id=p_salon_id and user_id=p_staff_user_id and is_active) then return jsonb_build_object('available',false,'reason','inactive_staff'); end if;
 v_local_start:=p_starts_at at time zone v_timezone; v_local_end:=p_ends_at at time zone v_timezone;
 if v_local_start::date<>v_local_end::date then return jsonb_build_object('available',false,'reason','outside_work_hours'); end if;
 select * into v_rule from public.ludia_staff_work_rules where salon_id=p_salon_id and staff_user_id=p_staff_user_id and weekday=extract(dow from v_local_start)::smallint;
 -- No rule means legacy/open scheduling. Once a weekday rule exists it is authoritative.
 if found and (not v_rule.is_working or v_rule.starts_at is null or v_rule.ends_at is null or v_local_start::time<v_rule.starts_at or v_local_end::time>v_rule.ends_at) then return jsonb_build_object('available',false,'reason','outside_work_hours'); end if;
 if exists(select 1 from public.ludia_staff_time_off t where t.salon_id=p_salon_id and t.staff_user_id=p_staff_user_id and t.starts_at<p_ends_at and t.ends_at>p_starts_at) then return jsonb_build_object('available',false,'reason','time_off'); end if;
 if exists(select 1 from public.ludia_appointments a where a.salon_id=p_salon_id and a.staff_user_id=p_staff_user_id and a.status not in ('cancelled','no_show') and (p_exclude_appointment_id is null or a.id<>p_exclude_appointment_id) and a.starts_at<p_ends_at and a.ends_at>p_starts_at) then return jsonb_build_object('available',false,'reason','appointment_conflict'); end if;
 return jsonb_build_object('available',true,'reason',null);
end $$;
revoke all on function public.ludia_staff_availability(uuid,uuid,timestamptz,timestamptz,uuid) from public,anon;
grant execute on function public.ludia_staff_availability(uuid,uuid,timestamptz,timestamptz,uuid) to authenticated;

create or replace function public.ludia_guard_appointment_staff_availability() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_timezone text := 'Asia/Seoul'; v_local_start timestamp; v_local_end timestamp; v_rule public.ludia_staff_work_rules%rowtype;
begin
 -- Unassigned bookings remain valid so Naver imports can land before explicit staff mapping.
 if new.staff_user_id is null or new.status in ('cancelled','no_show') then return new; end if;
 -- Checkout/status-only updates must not invalidate an appointment that was valid when booked.
 if tg_op='UPDATE' and new.staff_user_id is not distinct from old.staff_user_id and new.starts_at is not distinct from old.starts_at and new.ends_at is not distinct from old.ends_at then return new; end if;
 if not exists(select 1 from public.ludia_salon_members m where m.salon_id=new.salon_id and m.user_id=new.staff_user_id and m.is_active) then raise exception using message='LUDIA_AVAILABILITY:inactive_staff',errcode='P0001'; end if;
 select coalesce(timezone,'Asia/Seoul') into v_timezone from public.ludia_salons where id=new.salon_id;
 v_local_start:=new.starts_at at time zone v_timezone; v_local_end:=new.ends_at at time zone v_timezone;
 if v_local_start::date<>v_local_end::date then raise exception using message='LUDIA_AVAILABILITY:outside_work_hours',errcode='P0001'; end if;
 select * into v_rule from public.ludia_staff_work_rules where salon_id=new.salon_id and staff_user_id=new.staff_user_id and weekday=extract(dow from v_local_start)::smallint;
 if found and (not v_rule.is_working or v_rule.starts_at is null or v_rule.ends_at is null or v_local_start::time<v_rule.starts_at or v_local_end::time>v_rule.ends_at) then raise exception using message='LUDIA_AVAILABILITY:outside_work_hours',errcode='P0001'; end if;
 if exists(select 1 from public.ludia_staff_time_off t where t.salon_id=new.salon_id and t.staff_user_id=new.staff_user_id and t.starts_at<new.ends_at and t.ends_at>new.starts_at) then raise exception using message='LUDIA_AVAILABILITY:time_off',errcode='P0001'; end if;
 if exists(select 1 from public.ludia_appointments a where a.salon_id=new.salon_id and a.staff_user_id=new.staff_user_id and a.status not in ('cancelled','no_show') and a.id<>new.id and a.starts_at<new.ends_at and a.ends_at>new.starts_at) then raise exception using message='LUDIA_AVAILABILITY:appointment_conflict',errcode='P0001'; end if;
 return new;
end $$;
revoke all on function public.ludia_guard_appointment_staff_availability() from public,anon,authenticated;
drop trigger if exists ludia_appointment_staff_availability_guard on public.ludia_appointments;
create trigger ludia_appointment_staff_availability_guard before insert or update of staff_user_id,starts_at,ends_at,status on public.ludia_appointments for each row execute function public.ludia_guard_appointment_staff_availability();
create index if not exists ludia_appointments_staff_overlap_idx on public.ludia_appointments(salon_id,staff_user_id,starts_at,ends_at) where status not in ('cancelled','no_show');
