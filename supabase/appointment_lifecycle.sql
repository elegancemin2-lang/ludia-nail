-- LUDIA NAIL · appointment lifecycle customer statistics
-- Apply after salon_os.sql. This keeps CRM visit counters derived from completed appointments.
-- It is deliberately payment-neutral: marking a service complete must never invent a payment method.

create or replace function public.ludia_refresh_customer_visit_stats(target_customer uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if target_customer is null then return; end if;

  update public.ludia_customers c
  set visit_count = s.visit_count,
      last_visit_at = s.last_visit_at,
      updated_at = now()
  from (
    select count(*)::integer as visit_count, max(a.starts_at) as last_visit_at
    from public.ludia_appointments a
    where a.customer_id = target_customer
      and a.status = 'completed'
  ) s
  where c.id = target_customer;
end
$$;

-- Trigger-only helpers are not exposed through the Data API.
revoke all on function public.ludia_refresh_customer_visit_stats(uuid) from public, anon, authenticated;

create or replace function public.ludia_sync_customer_visit_stats()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  -- If an appointment is reassigned, repair both customers atomically.
  if tg_op = 'UPDATE' and old.customer_id is distinct from new.customer_id then
    perform public.ludia_refresh_customer_visit_stats(old.customer_id);
  end if;

  perform public.ludia_refresh_customer_visit_stats(new.customer_id);
  return new;
end
$$;

revoke all on function public.ludia_sync_customer_visit_stats() from public, anon, authenticated;

drop trigger if exists ludia_appointments_customer_stats_insert on public.ludia_appointments;
create trigger ludia_appointments_customer_stats_insert
after insert on public.ludia_appointments
for each row execute function public.ludia_sync_customer_visit_stats();

drop trigger if exists ludia_appointments_customer_stats_update on public.ludia_appointments;
create trigger ludia_appointments_customer_stats_update
after update of status, customer_id, starts_at on public.ludia_appointments
for each row
when (
  old.status is distinct from new.status
  or old.customer_id is distinct from new.customer_id
  or old.starts_at is distinct from new.starts_at
)
execute function public.ludia_sync_customer_visit_stats();
