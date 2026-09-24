-- LUDIA NAIL · manager-safe Naver schedule conflict resolution
-- Apply after naver_conflict_guard.sql.
-- No Naver credentials/session material is read or stored here.

create or replace function public.ludia_resolve_naver_conflict(
  p_conflict_id bigint,
  p_action text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_conflict public.ludia_naver_sync_conflicts%rowtype;
  v_appt public.ludia_appointments%rowtype;
  v_overlap uuid;
  v_resolution text;
begin
  if p_action not in ('keep_ludia','accept_naver') then
    raise exception 'invalid resolution action';
  end if;

  select * into v_conflict
  from public.ludia_naver_sync_conflicts
  where id=p_conflict_id
  for update;
  if not found then raise exception 'conflict not found'; end if;
  if not public.ludia_is_salon_manager(v_conflict.salon_id) then raise exception 'manager required'; end if;
  if v_conflict.resolved_at is not null then
    return jsonb_build_object('ok',true,'alreadyResolved',true,'resolution',v_conflict.resolution);
  end if;

  select * into v_appt from public.ludia_appointments where id=v_conflict.appointment_id for update;
  if not found or v_appt.salon_id<>v_conflict.salon_id then raise exception 'appointment unavailable'; end if;

  if p_action='accept_naver' then
    if v_appt.status in ('cancelled','completed','no_show') then raise exception 'appointment is no longer movable'; end if;
    if v_appt.staff_user_id is not null then
      select a.id into v_overlap
      from public.ludia_appointments a
      where a.salon_id=v_conflict.salon_id
        and a.id<>v_appt.id
        and a.staff_user_id=v_appt.staff_user_id
        and a.status not in ('cancelled','completed','no_show')
        and a.starts_at < v_conflict.requested_ends_at
        and a.ends_at > v_conflict.requested_starts_at
      order by a.starts_at limit 1;
    end if;
    if v_overlap is not null then raise exception 'requested time still conflicts'; end if;
    update public.ludia_appointments
      set starts_at=v_conflict.requested_starts_at,
          ends_at=v_conflict.requested_ends_at,
          source_updated_at=now()
      where id=v_appt.id;
    v_resolution:='accepted_naver';
  else
    v_resolution:='kept_ludia';
  end if;

  update public.ludia_naver_sync_conflicts
    set resolved_at=now(),resolution=v_resolution
    where id=v_conflict.id;

  return jsonb_build_object('ok',true,'resolution',v_resolution,'appointmentId',v_appt.id);
end;
$$;

revoke all on function public.ludia_resolve_naver_conflict(bigint,text) from public,anon;
grant execute on function public.ludia_resolve_naver_conflict(bigint,text) to authenticated;
