-- LUDIA NAIL · guarded appointment lifecycle transitions
-- Apply after salon_os.sql. Checkout remains the only path that marks an appointment completed.

create or replace function public.ludia_transition_appointment(
  p_salon_id uuid,
  p_appointment_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.ludia_appointments%rowtype;
  allowed boolean := false;
begin
  if auth.uid() is null or not public.ludia_is_salon_member(p_salon_id) then
    raise exception 'salon access denied';
  end if;

  if p_next_status not in ('arrived','in_service','no_show') then
    raise exception 'unsupported transition';
  end if;

  select * into a
  from public.ludia_appointments
  where id=p_appointment_id and salon_id=p_salon_id
  for update;

  if not found then raise exception 'appointment not found'; end if;
  if a.status in ('completed','cancelled') then raise exception 'appointment is closed'; end if;

  allowed := case
    when p_next_status='arrived' then a.status in ('pending','confirmed')
    when p_next_status='in_service' then a.status in ('pending','confirmed','arrived')
    when p_next_status='no_show' then a.status in ('pending','confirmed','arrived')
    else false
  end;

  if not allowed then raise exception 'invalid appointment transition: % -> %',a.status,p_next_status; end if;

  update public.ludia_appointments
  set status=p_next_status
  where id=a.id;

  return jsonb_build_object('id',a.id,'previous_status',a.status,'status',p_next_status,'updated_at',now());
end
$$;

revoke all on function public.ludia_transition_appointment(uuid,uuid,text) from public, anon;
grant execute on function public.ludia_transition_appointment(uuid,uuid,text) to authenticated;
