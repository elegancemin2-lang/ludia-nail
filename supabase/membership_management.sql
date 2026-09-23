-- LUDIA NAIL · production membership management
-- Apply after supabase/salon_os.sql.
-- Membership sale creates the pass, paid sales row, and opening ledger atomically.

create or replace function public.ludia_sell_membership(
  p_salon_id uuid,
  p_customer_id uuid,
  p_product_id uuid,
  p_payment_method text default 'card',
  p_staff_user_id uuid default null,
  p_memo text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_product public.ludia_membership_products%rowtype;
  v_membership public.ludia_customer_memberships%rowtype;
  v_payment_id uuid;
  v_expires_at timestamptz;
begin
  if auth.uid() is null or not public.ludia_is_salon_member(p_salon_id) then
    raise exception 'not_authorized';
  end if;
  if p_payment_method not in ('card','cash','transfer','other') then
    raise exception 'invalid_payment_method';
  end if;
  if not exists(select 1 from public.ludia_customers where id=p_customer_id and salon_id=p_salon_id) then
    raise exception 'customer_not_found';
  end if;
  if p_staff_user_id is not null and not exists(
    select 1 from public.ludia_salon_members where salon_id=p_salon_id and user_id=p_staff_user_id and is_active
  ) then
    raise exception 'staff_not_found';
  end if;

  select * into v_product
  from public.ludia_membership_products
  where id=p_product_id and salon_id=p_salon_id and is_active
  for share;
  if not found then raise exception 'membership_product_not_found'; end if;
  if v_product.kind='amount' and coalesce(v_product.credit_amount,0)<=0 then raise exception 'invalid_amount_credit'; end if;
  if v_product.kind='count' and coalesce(v_product.credit_count,0)<=0 then raise exception 'invalid_count_credit'; end if;

  v_expires_at := case when v_product.valid_days is null then null else now() + make_interval(days=>v_product.valid_days) end;

  insert into public.ludia_customer_memberships(
    salon_id,customer_id,product_id,kind,name_snapshot,remaining_amount,remaining_count,starts_at,expires_at,status
  ) values (
    p_salon_id,p_customer_id,v_product.id,v_product.kind,v_product.name,
    case when v_product.kind='amount' then v_product.credit_amount else null end,
    case when v_product.kind='count' then v_product.credit_count else null end,
    now(),v_expires_at,'active'
  ) returning * into v_membership;

  insert into public.ludia_membership_ledger(
    salon_id,membership_id,delta_amount,delta_count,reason,created_by
  ) values (
    p_salon_id,v_membership.id,
    case when v_product.kind='amount' then v_product.credit_amount else null end,
    case when v_product.kind='count' then v_product.credit_count else null end,
    '회원권 판매',auth.uid()
  );

  insert into public.ludia_payments(
    salon_id,customer_id,staff_user_id,amount,method,status,memo,paid_at
  ) values (
    p_salon_id,p_customer_id,p_staff_user_id,v_product.sale_price,p_payment_method,'paid',
    concat('회원권 판매 · ',v_product.name,case when nullif(trim(p_memo),'') is null then '' else ' · '||trim(p_memo) end),now()
  ) returning id into v_payment_id;

  return jsonb_build_object(
    'membershipId',v_membership.id,'paymentId',v_payment_id,'name',v_product.name,'kind',v_product.kind,
    'remainingAmount',v_membership.remaining_amount,'remainingCount',v_membership.remaining_count,
    'expiresAt',v_membership.expires_at,'salePrice',v_product.sale_price
  );
end
$$;

create or replace function public.ludia_adjust_membership(
  p_salon_id uuid,
  p_membership_id uuid,
  p_delta_amount integer default null,
  p_delta_count integer default null,
  p_reason text default '관리자 조정'
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_membership public.ludia_customer_memberships%rowtype;
  v_next_amount integer;
  v_next_count integer;
begin
  if auth.uid() is null or not public.ludia_is_salon_manager(p_salon_id) then
    raise exception 'manager_required';
  end if;
  if nullif(trim(p_reason),'') is null then raise exception 'reason_required'; end if;

  select * into v_membership
  from public.ludia_customer_memberships
  where id=p_membership_id and salon_id=p_salon_id
  for update;
  if not found then raise exception 'membership_not_found'; end if;
  if v_membership.status='cancelled' then raise exception 'membership_cancelled'; end if;

  if v_membership.kind='amount' then
    if p_delta_amount is null or p_delta_amount=0 or p_delta_count is not null then raise exception 'invalid_amount_adjustment'; end if;
    v_next_amount := coalesce(v_membership.remaining_amount,0)+p_delta_amount;
    if v_next_amount<0 then raise exception 'insufficient_membership_balance'; end if;
    update public.ludia_customer_memberships
      set remaining_amount=v_next_amount,status=case when v_next_amount=0 then 'used' else 'active' end
      where id=v_membership.id;
  else
    if p_delta_count is null or p_delta_count=0 or p_delta_amount is not null then raise exception 'invalid_count_adjustment'; end if;
    v_next_count := coalesce(v_membership.remaining_count,0)+p_delta_count;
    if v_next_count<0 then raise exception 'insufficient_membership_count'; end if;
    update public.ludia_customer_memberships
      set remaining_count=v_next_count,status=case when v_next_count=0 then 'used' else 'active' end
      where id=v_membership.id;
  end if;

  insert into public.ludia_membership_ledger(
    salon_id,membership_id,delta_amount,delta_count,reason,created_by
  ) values (p_salon_id,v_membership.id,p_delta_amount,p_delta_count,trim(p_reason),auth.uid());

  return jsonb_build_object(
    'membershipId',v_membership.id,'kind',v_membership.kind,
    'remainingAmount',case when v_membership.kind='amount' then v_next_amount else null end,
    'remainingCount',case when v_membership.kind='count' then v_next_count else null end
  );
end
$$;

revoke all on function public.ludia_sell_membership(uuid,uuid,uuid,text,uuid,text) from public,anon;
revoke all on function public.ludia_adjust_membership(uuid,uuid,integer,integer,text) from public,anon;
grant execute on function public.ludia_sell_membership(uuid,uuid,uuid,text,uuid,text) to authenticated;
grant execute on function public.ludia_adjust_membership(uuid,uuid,integer,integer,text) to authenticated;
