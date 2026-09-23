-- LUDIA NAIL · staff operations
-- Apply after supabase/salon_os.sql and sales_reporting.sql.
-- No credentials are stored here. Staff rows refer only to authenticated salon members.

create table if not exists public.ludia_staff_work_rules (
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_working boolean not null default true,
  starts_at time,
  ends_at time,
  break_minutes integer not null default 0 check (break_minutes between 0 and 480),
  updated_at timestamptz not null default now(),
  primary key (salon_id,staff_user_id,weekday),
  check (not is_working or (starts_at is not null and ends_at is not null and ends_at > starts_at))
);

create table if not exists public.ludia_staff_time_off (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'off' check (kind in ('off','vacation','sick','other')),
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists ludia_staff_time_off_calendar_idx on public.ludia_staff_time_off(salon_id,staff_user_id,starts_at,ends_at);

create table if not exists public.ludia_staff_pay_profiles (
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  base_monthly_pay integer not null default 0 check (base_monthly_pay >= 0),
  sales_commission_rate numeric(5,2) not null default 0 check (sales_commission_rate between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (salon_id,staff_user_id)
);

alter table public.ludia_staff_work_rules enable row level security;
alter table public.ludia_staff_time_off enable row level security;
alter table public.ludia_staff_pay_profiles enable row level security;
revoke all on table public.ludia_staff_work_rules,public.ludia_staff_time_off,public.ludia_staff_pay_profiles from anon;
grant select on table public.ludia_staff_work_rules,public.ludia_staff_time_off,public.ludia_staff_pay_profiles to authenticated;
grant insert,update,delete on table public.ludia_staff_work_rules,public.ludia_staff_time_off,public.ludia_staff_pay_profiles to authenticated;

do $$ begin
 create policy ludia_staff_work_rules_member_select on public.ludia_staff_work_rules for select to authenticated using (public.ludia_is_salon_member(salon_id));
 create policy ludia_staff_work_rules_manager_insert on public.ludia_staff_work_rules for insert to authenticated with check (public.ludia_is_salon_manager(salon_id));
 create policy ludia_staff_work_rules_manager_update on public.ludia_staff_work_rules for update to authenticated using (public.ludia_is_salon_manager(salon_id)) with check (public.ludia_is_salon_manager(salon_id));
 create policy ludia_staff_work_rules_manager_delete on public.ludia_staff_work_rules for delete to authenticated using (public.ludia_is_salon_manager(salon_id));
exception when duplicate_object then null; end $$;

do $$ begin
 create policy ludia_staff_time_off_member_select on public.ludia_staff_time_off for select to authenticated using (public.ludia_is_salon_member(salon_id));
 create policy ludia_staff_time_off_manager_insert on public.ludia_staff_time_off for insert to authenticated with check (public.ludia_is_salon_manager(salon_id));
 create policy ludia_staff_time_off_manager_update on public.ludia_staff_time_off for update to authenticated using (public.ludia_is_salon_manager(salon_id)) with check (public.ludia_is_salon_manager(salon_id));
 create policy ludia_staff_time_off_manager_delete on public.ludia_staff_time_off for delete to authenticated using (public.ludia_is_salon_manager(salon_id));
exception when duplicate_object then null; end $$;

do $$ begin
 create policy ludia_staff_pay_profiles_member_select on public.ludia_staff_pay_profiles for select to authenticated using (public.ludia_is_salon_member(salon_id));
 create policy ludia_staff_pay_profiles_manager_insert on public.ludia_staff_pay_profiles for insert to authenticated with check (public.ludia_is_salon_manager(salon_id));
 create policy ludia_staff_pay_profiles_manager_update on public.ludia_staff_pay_profiles for update to authenticated using (public.ludia_is_salon_manager(salon_id)) with check (public.ludia_is_salon_manager(salon_id));
 create policy ludia_staff_pay_profiles_manager_delete on public.ludia_staff_pay_profiles for delete to authenticated using (public.ludia_is_salon_manager(salon_id));
exception when duplicate_object then null; end $$;

do $$ begin alter publication supabase_realtime add table public.ludia_staff_work_rules; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ludia_staff_time_off; exception when duplicate_object then null; end $$;

create or replace function public.ludia_staff_month_summary(p_salon_id uuid,p_month date default current_date)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_start date; v_end date; v_result jsonb;
begin
 if not public.ludia_is_salon_member(p_salon_id) then raise exception 'not authorized'; end if;
 v_start=date_trunc('month',p_month)::date; v_end=(v_start+interval '1 month')::date;
 select jsonb_build_object(
  'month',v_start,
  'staff',coalesce(jsonb_agg(jsonb_build_object(
   'user_id',m.user_id,'name',m.display_name,'role',m.role,
   'sales',coalesce(s.sales,0),'payments',coalesce(s.payments,0),'completed',coalesce(a.completed,0),
   'base_pay',coalesce(pp.base_monthly_pay,0),'commission_rate',coalesce(pp.sales_commission_rate,m.commission_rate,0),
   'commission',round(coalesce(s.sales,0)*coalesce(pp.sales_commission_rate,m.commission_rate,0)/100.0),
   'estimated_pay',coalesce(pp.base_monthly_pay,0)+round(coalesce(s.sales,0)*coalesce(pp.sales_commission_rate,m.commission_rate,0)/100.0)
  ) order by m.display_name),'[]'::jsonb)
 ) into v_result
 from public.ludia_salon_members m
 left join public.ludia_staff_pay_profiles pp on pp.salon_id=m.salon_id and pp.staff_user_id=m.user_id
 left join lateral (select sum(p.amount)::bigint sales,count(*)::int payments from public.ludia_payments p where p.salon_id=m.salon_id and p.staff_user_id=m.user_id and p.status='paid' and p.paid_at>=v_start and p.paid_at<v_end) s on true
 left join lateral (select count(*)::int completed from public.ludia_appointments x where x.salon_id=m.salon_id and x.staff_user_id=m.user_id and x.status='completed' and x.starts_at>=v_start and x.starts_at<v_end) a on true
 where m.salon_id=p_salon_id and m.is_active;
 return v_result;
end $$;
revoke all on function public.ludia_staff_month_summary(uuid,date) from public,anon;
grant execute on function public.ludia_staff_month_summary(uuid,date) to authenticated;
