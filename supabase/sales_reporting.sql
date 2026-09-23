-- LUDIA NAIL · production sales reporting
-- Apply after salon_os.sql and appointment_checkout.sql.
-- One server-side aggregate keeps revenue math consistent across mobile/desktop clients.
-- Uses paid payments only; refunded/void rows are excluded from revenue.

create or replace function public.ludia_sales_summary(
  p_salon_id uuid,
  p_from timestamptz,
  p_to timestamptz
) returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if p_salon_id is null then
    raise exception 'salon_id_required';
  end if;
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'invalid_sales_range';
  end if;
  if not public.ludia_is_salon_member(p_salon_id) then
    raise exception 'salon_access_denied';
  end if;
  if p_to - p_from > interval '370 days' then
    raise exception 'sales_range_too_large';
  end if;

  with paid as (
    select
      p.id,
      p.amount,
      p.method,
      p.paid_at,
      p.staff_user_id,
      p.customer_id,
      p.appointment_id
    from public.ludia_payments p
    where p.salon_id = p_salon_id
      and p.status = 'paid'
      and p.paid_at >= p_from
      and p.paid_at < p_to
  ),
  totals as (
    select
      coalesce(sum(amount),0)::bigint as gross_sales,
      count(*)::bigint as payment_count,
      count(distinct customer_id) filter (where customer_id is not null)::bigint as customer_count,
      count(distinct appointment_id) filter (where appointment_id is not null)::bigint as appointment_count
    from paid
  ),
  methods as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'method',method,
      'amount',amount,
      'count',payment_count
    ) order by amount desc),'[]'::jsonb) as data
    from (
      select method,sum(amount)::bigint amount,count(*)::bigint payment_count
      from paid
      group by method
    ) x
  ),
  staff as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'staffUserId',x.staff_user_id,
      'staffName',x.staff_name,
      'amount',x.amount,
      'count',x.payment_count,
      'averageTicket',case when x.payment_count=0 then 0 else round(x.amount::numeric/x.payment_count)::bigint end
    ) order by x.amount desc),'[]'::jsonb) as data
    from (
      select
        p.staff_user_id,
        coalesce(m.display_name,'미지정') staff_name,
        sum(p.amount)::bigint amount,
        count(*)::bigint payment_count
      from paid p
      left join public.ludia_salon_members m
        on m.salon_id=p_salon_id and m.user_id=p.staff_user_id
      group by p.staff_user_id,m.display_name
    ) x
  ),
  daily as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date',x.sales_date,
      'amount',x.amount,
      'count',x.payment_count
    ) order by x.sales_date),'[]'::jsonb) as data
    from (
      select
        (p.paid_at at time zone coalesce(s.timezone,'Asia/Seoul'))::date sales_date,
        sum(p.amount)::bigint amount,
        count(*)::bigint payment_count
      from paid p
      cross join public.ludia_salons s
      where s.id=p_salon_id
      group by 1
    ) x
  )
  select jsonb_build_object(
    'salonId',p_salon_id,
    'from',p_from,
    'to',p_to,
    'grossSales',t.gross_sales,
    'paymentCount',t.payment_count,
    'customerCount',t.customer_count,
    'appointmentCount',t.appointment_count,
    'averageTicket',case when t.payment_count=0 then 0 else round(t.gross_sales::numeric/t.payment_count)::bigint end,
    'methods',m.data,
    'staff',st.data,
    'daily',d.data
  ) into v_result
  from totals t cross join methods m cross join staff st cross join daily d;

  return v_result;
end
$$;

revoke all on function public.ludia_sales_summary(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.ludia_sales_summary(uuid,timestamptz,timestamptz) to authenticated;

comment on function public.ludia_sales_summary(uuid,timestamptz,timestamptz) is
  'RLS-aware LUDIA sales aggregate: gross sales, average ticket, payment method, staff and daily breakdown. Paid rows only; max range 370 days.';
