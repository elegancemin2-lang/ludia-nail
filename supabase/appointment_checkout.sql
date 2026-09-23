-- LUDIA NAIL · atomic appointment checkout
-- Apply after salon_os.sql and appointment_lifecycle.sql.
-- Completes a service, records payment, and consumes membership credit in one transaction.

create unique index if not exists ludia_payments_one_paid_per_appointment_uq
on public.ludia_payments(appointment_id)
where appointment_id is not null and status='paid';

create or replace function public.ludia_checkout_appointment(
  target_appointment uuid,
  payment_method text,
  paid_amount integer default null,
  target_membership uuid default null,
  payment_memo text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  a public.ludia_appointments%rowtype;
  m public.ludia_customer_memberships%rowtype;
  charge integer;
  payment_id uuid;
  new_amount integer;
  new_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if payment_method not in ('card','cash','transfer','membership','other') then
    raise exception 'unsupported payment method';
  end if;

  select * into a from public.ludia_appointments where id=target_appointment for update;
  if not found then raise exception 'appointment not found'; end if;
  if not public.ludia_is_salon_member(a.salon_id) then raise exception 'forbidden'; end if;
  if a.status in ('cancelled','no_show') then raise exception 'appointment cannot be checked out'; end if;
  if exists(select 1 from public.ludia_payments p where p.appointment_id=a.id and p.status='paid') then
    raise exception 'appointment already paid';
  end if;

  charge := coalesce(paid_amount,a.price,0);
  if charge < 0 then raise exception 'paid amount must be non-negative'; end if;

  if payment_method='membership' then
    if target_membership is null then raise exception 'membership required'; end if;
    select * into m from public.ludia_customer_memberships
      where id=target_membership and salon_id=a.salon_id and customer_id=a.customer_id and status='active'
      for update;
    if not found then raise exception 'active membership not found'; end if;
    if m.expires_at is not null and m.expires_at < now() then raise exception 'membership expired'; end if;

    if m.kind='amount' then
      if coalesce(m.remaining_amount,0) < charge then raise exception 'insufficient membership balance'; end if;
      new_amount := m.remaining_amount-charge;
      update public.ludia_customer_memberships
      set remaining_amount=new_amount,
          status=case when new_amount=0 then 'used' else status end
      where id=m.id;
      insert into public.ludia_membership_ledger(salon_id,membership_id,appointment_id,delta_amount,reason,created_by)
      values(a.salon_id,m.id,a.id,-charge,'appointment_checkout',auth.uid());
    else
      if coalesce(m.remaining_count,0) < 1 then raise exception 'insufficient membership count'; end if;
      new_count := m.remaining_count-1;
      update public.ludia_customer_memberships
      set remaining_count=new_count,
          status=case when new_count=0 then 'used' else status end
      where id=m.id;
      insert into public.ludia_membership_ledger(salon_id,membership_id,appointment_id,delta_count,reason,created_by)
      values(a.salon_id,m.id,a.id,-1,'appointment_checkout',auth.uid());
    end if;
  elsif target_membership is not null then
    raise exception 'membership must only be supplied for membership payment';
  end if;

  insert into public.ludia_payments(salon_id,appointment_id,customer_id,staff_user_id,amount,method,status,memo)
  values(a.salon_id,a.id,a.customer_id,a.staff_user_id,charge,payment_method,'paid',coalesce(payment_memo,''))
  returning id into payment_id;

  update public.ludia_appointments set status='completed' where id=a.id;

  return jsonb_build_object(
    'appointment_id',a.id,
    'payment_id',payment_id,
    'amount',charge,
    'method',payment_method,
    'membership_id',target_membership,
    'remaining_amount',new_amount,
    'remaining_count',new_count
  );
end
$$;

revoke all on function public.ludia_checkout_appointment(uuid,text,integer,uuid,text) from public, anon;
grant execute on function public.ludia_checkout_appointment(uuid,text,integer,uuid,text) to authenticated;
