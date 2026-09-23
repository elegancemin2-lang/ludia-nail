-- LUDIA NAIL · customer 360 profile
-- Apply after salon_os.sql, appointment_checkout.sql and membership_management.sql.
-- A single member-authorized read model powers the native customer detail sheet without client-side joins.

create or replace function public.ludia_customer_360(
  p_salon_id uuid,
  p_customer_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_customer public.ludia_customers%rowtype;
  v_result jsonb;
begin
  if p_salon_id is null or p_customer_id is null then
    raise exception 'customer_context_required';
  end if;
  if not public.ludia_is_salon_member(p_salon_id) then
    raise exception 'salon_access_denied';
  end if;

  select * into v_customer
  from public.ludia_customers
  where id=p_customer_id and salon_id=p_salon_id;
  if not found then raise exception 'customer_not_found'; end if;

  with appts as (
    select a.id,a.starts_at,a.ends_at,a.status,a.price,a.service_name_snapshot,a.staff_user_id,a.source,a.memo,
           coalesce(m.display_name,'미지정') staff_name
    from public.ludia_appointments a
    left join public.ludia_salon_members m on m.salon_id=a.salon_id and m.user_id=a.staff_user_id
    where a.salon_id=p_salon_id and a.customer_id=p_customer_id
    order by a.starts_at desc limit 30
  ), appointment_json as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'startsAt',starts_at,'endsAt',ends_at,'status',status,'price',price,
      'service',service_name_snapshot,'staffUserId',staff_user_id,'staffName',staff_name,
      'source',source,'memo',memo
    ) order by starts_at desc),'[]'::jsonb) data from appts
  ), memberships as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',cm.id,'kind',cm.kind,'name',cm.name_snapshot,'remainingAmount',cm.remaining_amount,
      'remainingCount',cm.remaining_count,'status',cm.status,'expiresAt',cm.expires_at
    ) order by (cm.status='active') desc,cm.expires_at nulls last),'[]'::jsonb) data
    from public.ludia_customer_memberships cm
    where cm.salon_id=p_salon_id and cm.customer_id=p_customer_id
  ), revenue as (
    select coalesce(sum(p.amount),0)::bigint lifetime_sales,
           count(*)::bigint payment_count,
           max(p.paid_at) last_paid_at
    from public.ludia_payments p
    where p.salon_id=p_salon_id and p.customer_id=p_customer_id and p.status='paid'
  )
  select jsonb_build_object(
    'customer',jsonb_build_object(
      'id',v_customer.id,'name',v_customer.name,'phone',v_customer.phone,'memo',v_customer.memo,
      'tags',coalesce(v_customer.tags,'{}'::text[]),'preferences',coalesce(v_customer.preferences,'{}'::jsonb),
      'visitCount',coalesce(v_customer.visit_count,0),'lastVisitAt',v_customer.last_visit_at
    ),
    'lifetimeSales',r.lifetime_sales,
    'paymentCount',r.payment_count,
    'averageTicket',case when r.payment_count=0 then 0 else round(r.lifetime_sales::numeric/r.payment_count)::bigint end,
    'lastPaidAt',r.last_paid_at,
    'memberships',ms.data,
    'appointments',aj.data
  ) into v_result
  from appointment_json aj cross join memberships ms cross join revenue r;

  return v_result;
end
$$;

revoke all on function public.ludia_customer_360(uuid,uuid) from public, anon;
grant execute on function public.ludia_customer_360(uuid,uuid) to authenticated;

comment on function public.ludia_customer_360(uuid,uuid) is
  'Member-authorized customer 360 read model: profile, preferences, memberships, recent appointments and paid lifetime sales.';
