-- LUDIA NAIL · actionable customer revisit queue
-- Apply after salon_os.sql. Gives the front desk a single safe read model for customers
-- who have visited but do not currently have a future active reservation.

create or replace function public.ludia_customer_retention_queue(
  p_salon_id uuid,
  p_min_days_since_visit integer default 21,
  p_limit integer default 50
) returns table (
  customer_id uuid,
  customer_name text,
  phone text,
  marketing_consent boolean,
  tags text[],
  last_visit_at timestamptz,
  days_since_visit integer,
  next_visit_due_at timestamptz,
  days_overdue integer,
  last_service text,
  last_staff_user_id uuid,
  last_staff_name text,
  lifetime_sales bigint,
  visit_count integer,
  priority_score integer
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if p_salon_id is null then
    raise exception 'salon_required';
  end if;
  if not public.ludia_is_salon_member(p_salon_id) then
    raise exception 'salon_access_denied';
  end if;
  if p_min_days_since_visit < 0 or p_min_days_since_visit > 3650 then
    raise exception 'invalid_min_days';
  end if;
  if p_limit < 1 or p_limit > 200 then
    raise exception 'invalid_limit';
  end if;

  return query
  with last_completed as (
    select distinct on (a.customer_id)
      a.customer_id,
      a.starts_at,
      a.service_name_snapshot,
      a.staff_user_id,
      coalesce(m.display_name,'미지정') as staff_name
    from public.ludia_appointments a
    left join public.ludia_salon_members m
      on m.salon_id=a.salon_id and m.user_id=a.staff_user_id
    where a.salon_id=p_salon_id
      and a.customer_id is not null
      and a.status='completed'
    order by a.customer_id,a.starts_at desc
  ), future_active as (
    select distinct a.customer_id
    from public.ludia_appointments a
    where a.salon_id=p_salon_id
      and a.customer_id is not null
      and a.status in ('pending','confirmed','arrived','in_service')
      and a.ends_at > now()
  ), revenue as (
    select p.customer_id,coalesce(sum(p.amount),0)::bigint as lifetime_sales
    from public.ludia_payments p
    where p.salon_id=p_salon_id
      and p.customer_id is not null
      and p.status='paid'
    group by p.customer_id
  )
  select
    c.id,
    c.name,
    c.phone,
    c.marketing_consent,
    coalesce(c.tags,'{}'::text[]),
    lc.starts_at,
    greatest(0,floor(extract(epoch from (now()-lc.starts_at))/86400)::integer),
    c.next_visit_due_at,
    case when c.next_visit_due_at is null then 0
         else greatest(0,floor(extract(epoch from (now()-c.next_visit_due_at))/86400)::integer)
    end,
    lc.service_name_snapshot,
    lc.staff_user_id,
    lc.staff_name,
    coalesce(r.lifetime_sales,0),
    coalesce(c.visit_count,0),
    (
      greatest(0,floor(extract(epoch from (now()-lc.starts_at))/86400)::integer)
      + case when c.next_visit_due_at is not null and c.next_visit_due_at < now()
             then least(120,greatest(0,floor(extract(epoch from (now()-c.next_visit_due_at))/86400)::integer)*2)
             else 0 end
      + least(50,coalesce(c.visit_count,0)*2)
    )::integer as priority_score
  from public.ludia_customers c
  join last_completed lc on lc.customer_id=c.id
  left join future_active fa on fa.customer_id=c.id
  left join revenue r on r.customer_id=c.id
  where c.salon_id=p_salon_id
    and fa.customer_id is null
    and lc.starts_at <= now() - make_interval(days=>p_min_days_since_visit)
  order by priority_score desc,lc.starts_at asc
  limit p_limit;
end
$$;

revoke all on function public.ludia_customer_retention_queue(uuid,integer,integer) from public, anon;
grant execute on function public.ludia_customer_retention_queue(uuid,integer,integer) to authenticated;

comment on function public.ludia_customer_retention_queue(uuid,integer,integer) is
  'Member-authorized revisit queue. Excludes customers with future active reservations and ranks due customers by recency, overdue due-date and visit history. marketing_consent is returned explicitly so contact UI can enforce consent rather than assuming it.';
