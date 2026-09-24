-- LUDIA NAIL · staff daily operations board
-- Apply after salon_os.sql. Read-only operational projection for a fast salon floor view.
-- Keeps business-day filtering and staff/customer joins server-side so every client sees the same queue.

create or replace function public.ludia_staff_day_board(
  p_salon_id uuid,
  p_day date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_now timestamptz := now();
  v_result jsonb;
begin
  if p_salon_id is null or not public.ludia_is_salon_member(p_salon_id) then
    raise exception 'not authorized';
  end if;

  -- Salon OS currently operates in Korea; explicit KST boundaries avoid browser timezone drift.
  v_start := (p_day::timestamp at time zone 'Asia/Seoul');
  v_end := ((p_day + 1)::timestamp at time zone 'Asia/Seoul');

  select jsonb_build_object(
    'day', p_day,
    'generated_at', v_now,
    'counts', jsonb_build_object(
      'upcoming', count(*) filter (where a.status in ('pending','confirmed') and a.starts_at >= v_now),
      'waiting', count(*) filter (where a.status = 'arrived'),
      'in_service', count(*) filter (where a.status = 'in_service'),
      'checkout', count(*) filter (where a.status = 'completed' and pay.appointment_id is null),
      'completed', count(*) filter (where a.status = 'completed'),
      'no_show', count(*) filter (where a.status = 'no_show')
    ),
    'staff', coalesce(jsonb_agg(staff_row order by staff_name) filter (where staff_row is not null), '[]'::jsonb)
  ) into v_result
  from (
    select m.display_name as staff_name,
      jsonb_build_object(
        'user_id', m.user_id,
        'name', m.display_name,
        'role', m.role,
        'appointments', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', a.id,
            'customer_id', a.customer_id,
            'customer_name', a.customer_name_snapshot,
            'customer_phone', a.customer_phone_snapshot,
            'service_name', a.service_name_snapshot,
            'starts_at', a.starts_at,
            'ends_at', a.ends_at,
            'status', a.status,
            'source', a.source,
            'price', a.price,
            'memo', a.memo,
            'is_late', a.status in ('pending','confirmed') and a.starts_at < v_now,
            'is_overrun', a.status = 'in_service' and a.ends_at < v_now,
            'needs_checkout', a.status = 'completed' and not exists (
              select 1 from public.ludia_payments p
              where p.salon_id = p_salon_id and p.appointment_id = a.id and p.status = 'paid'
            )
          ) order by a.starts_at)
          from public.ludia_appointments a
          where a.salon_id = p_salon_id
            and a.staff_user_id = m.user_id
            and a.starts_at >= v_start and a.starts_at < v_end
            and a.status <> 'cancelled'
        ), '[]'::jsonb)
      ) as staff_row
    from public.ludia_salon_members m
    where m.salon_id = p_salon_id and m.is_active
  ) staff_rows
  left join public.ludia_appointments a
    on a.salon_id = p_salon_id
   and a.staff_user_id = staff_rows.staff_row->>'user_id'::text
   and a.starts_at >= v_start and a.starts_at < v_end
   and a.status <> 'cancelled'
  left join lateral (
    select p.appointment_id
    from public.ludia_payments p
    where p.salon_id = p_salon_id and p.appointment_id = a.id and p.status = 'paid'
    limit 1
  ) pay on true;

  return coalesce(v_result, jsonb_build_object('day',p_day,'generated_at',v_now,'counts','{}'::jsonb,'staff','[]'::jsonb));
end
$$;

revoke all on function public.ludia_staff_day_board(uuid,date) from public, anon;
grant execute on function public.ludia_staff_day_board(uuid,date) to authenticated;
