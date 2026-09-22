-- LUDIA NAIL · production salon OS schema · shared INBETWEEN project / ludia_* namespace
-- Apply in Supabase SQL editor after enabling Auth.
-- This schema intentionally stores no Naver password/session secret.

create extension if not exists pgcrypto;

create table if not exists public.ludia_salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Seoul',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ludia_salon_members (
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  display_name text not null,
  is_active boolean not null default true,
  color_key text,
  commission_rate numeric(5,2) not null default 0 check (commission_rate between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (salon_id,user_id)
);

create table if not exists public.ludia_customers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  name text not null,
  phone text,
  phone_normalized text,
  memo text not null default '',
  preferences jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  visit_count integer not null default 0,
  last_visit_at timestamptz,
  next_visit_due_at timestamptz,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ludia_customers_salon_phone_uq on public.ludia_customers(salon_id,phone_normalized) where phone_normalized is not null;
create index if not exists ludia_customers_salon_name_idx on public.ludia_customers(salon_id,name);
create index if not exists ludia_customers_last_visit_idx on public.ludia_customers(salon_id,last_visit_at desc);

create table if not exists public.ludia_services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  name text not null,
  category text not null default '네일',
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  price integer not null default 0 check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ludia_services_salon_active_idx on public.ludia_services(salon_id,is_active,sort_order);

create table if not exists public.ludia_appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  customer_id uuid references public.ludia_customers(id) on delete set null,
  staff_user_id uuid references auth.users(id) on delete set null,
  service_id uuid references public.ludia_services(id) on delete set null,
  source text not null default 'manual' check (source in ('manual','naver','phone','walkin','other')),
  external_source_id text,
  customer_name_snapshot text not null,
  customer_phone_snapshot text,
  service_name_snapshot text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending','confirmed','arrived','in_service','completed','cancelled','no_show')),
  price integer not null default 0 check (price >= 0),
  memo text not null default '',
  cancelled_at timestamptz,
  cancellation_reason text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index if not exists ludia_appointments_external_uq on public.ludia_appointments(salon_id,source,external_source_id) where external_source_id is not null;
create index if not exists ludia_appointments_calendar_idx on public.ludia_appointments(salon_id,starts_at,staff_user_id);
create index if not exists ludia_appointments_customer_idx on public.ludia_appointments(salon_id,customer_id,starts_at desc);
create index if not exists ludia_appointments_status_idx on public.ludia_appointments(salon_id,status,starts_at);

create table if not exists public.ludia_membership_products (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('amount','count')),
  sale_price integer not null default 0 check (sale_price >= 0),
  credit_amount integer check (credit_amount is null or credit_amount >= 0),
  credit_count integer check (credit_count is null or credit_count >= 0),
  valid_days integer check (valid_days is null or valid_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ludia_customer_memberships (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  customer_id uuid not null references public.ludia_customers(id) on delete cascade,
  product_id uuid references public.ludia_membership_products(id) on delete set null,
  kind text not null check (kind in ('amount','count')),
  name_snapshot text not null,
  remaining_amount integer check (remaining_amount is null or remaining_amount >= 0),
  remaining_count integer check (remaining_count is null or remaining_count >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','used','expired','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ludia_customer_memberships_customer_idx on public.ludia_customer_memberships(salon_id,customer_id,status,expires_at);

create table if not exists public.ludia_payments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  appointment_id uuid references public.ludia_appointments(id) on delete set null,
  customer_id uuid references public.ludia_customers(id) on delete set null,
  staff_user_id uuid references auth.users(id) on delete set null,
  amount integer not null check (amount >= 0),
  method text not null check (method in ('card','cash','transfer','membership','mixed','other')),
  status text not null default 'paid' check (status in ('paid','refunded','void')),
  memo text not null default '',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ludia_payments_sales_idx on public.ludia_payments(salon_id,paid_at desc,staff_user_id);

create table if not exists public.ludia_membership_ledger (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  membership_id uuid not null references public.ludia_customer_memberships(id) on delete cascade,
  appointment_id uuid references public.ludia_appointments(id) on delete set null,
  delta_amount integer,
  delta_count integer,
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (coalesce(delta_amount,0) <> 0 or coalesce(delta_count,0) <> 0)
);
create index if not exists ludia_membership_ledger_membership_idx on public.ludia_membership_ledger(membership_id,created_at desc);

create or replace function public.ludia_touch_updated_at() returns trigger language plpgsql set search_path=public as $
begin new.updated_at = now(); return new; end $$;

do $$ begin
  create trigger ludia_salons_touch before update on public.ludia_salons for each row execute function public.ludia_touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger ludia_customers_touch before update on public.ludia_customers for each row execute function public.ludia_touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger ludia_appointments_touch before update on public.ludia_appointments for each row execute function public.ludia_touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger ludia_customer_memberships_touch before update on public.ludia_customer_memberships for each row execute function public.ludia_touch_updated_at();
exception when duplicate_object then null; end $$;

create or replace function public.ludia_is_salon_member(target_salon uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.ludia_salon_members m where m.salon_id=target_salon and m.user_id=auth.uid() and m.is_active)
$$;

create or replace function public.ludia_is_salon_manager(target_salon uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.ludia_salon_members m where m.salon_id=target_salon and m.user_id=auth.uid() and m.is_active and m.role in ('owner','manager'))
$$;

revoke all on function public.ludia_touch_updated_at() from public, anon, authenticated;
revoke all on function public.ludia_is_salon_member(uuid) from public, anon;
revoke all on function public.ludia_is_salon_manager(uuid) from public, anon;
grant execute on function public.ludia_is_salon_member(uuid) to authenticated;
grant execute on function public.ludia_is_salon_manager(uuid) to authenticated;

-- Data API privileges are explicit. RLS below still decides which rows each signed-in user can reach.
revoke all on table public.ludia_salons, public.ludia_salon_members, public.ludia_customers, public.ludia_services, public.ludia_appointments,
  public.ludia_membership_products, public.ludia_customer_memberships, public.ludia_payments, public.ludia_membership_ledger from anon;
grant select on table public.ludia_salons to authenticated;
grant select, insert, update, delete on table public.ludia_salon_members, public.ludia_customers, public.ludia_services, public.ludia_appointments,
  public.ludia_membership_products, public.ludia_customer_memberships, public.ludia_payments, public.ludia_membership_ledger to authenticated;

alter table public.ludia_salons enable row level security;
alter table public.ludia_salon_members enable row level security;
alter table public.ludia_customers enable row level security;
alter table public.ludia_services enable row level security;
alter table public.ludia_appointments enable row level security;
alter table public.ludia_membership_products enable row level security;
alter table public.ludia_customer_memberships enable row level security;
alter table public.ludia_payments enable row level security;
alter table public.ludia_membership_ledger enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ludia_customers','ludia_services','ludia_appointments','ludia_membership_products','ludia_customer_memberships','ludia_payments','ludia_membership_ledger'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.ludia_is_salon_member(salon_id))',t||'_member_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.ludia_is_salon_member(salon_id))',t||'_member_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (public.ludia_is_salon_member(salon_id)) with check (public.ludia_is_salon_member(salon_id))',t||'_member_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.ludia_is_salon_manager(salon_id))',t||'_manager_delete',t);
  end loop;
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy ludia_salons_member_select on public.ludia_salons for select to authenticated using (public.ludia_is_salon_member(id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy ludia_salon_members_member_select on public.ludia_salon_members for select to authenticated using (public.ludia_is_salon_member(salon_id));
exception when duplicate_object then null; end $$;
do $ begin
  create policy ludia_salon_members_manager_insert on public.ludia_salon_members for insert to authenticated with check (public.ludia_is_salon_manager(salon_id));
exception when duplicate_object then null; end $;
do $ begin
  create policy ludia_salon_members_manager_update on public.ludia_salon_members for update to authenticated using (public.ludia_is_salon_manager(salon_id)) with check (public.ludia_is_salon_manager(salon_id));
exception when duplicate_object then null; end $;
do $ begin
  create policy ludia_salon_members_manager_delete on public.ludia_salon_members for delete to authenticated using (public.ludia_is_salon_manager(salon_id));
exception when duplicate_object then null; end $;

-- Realtime: calendar/customer/member changes should appear immediately on every logged-in device.
do $$ begin alter publication supabase_realtime add table public.ludia_appointments; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ludia_customers; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ludia_customer_memberships; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ludia_payments; exception when duplicate_object then null; end $$;

-- Naver bridge contract: upsert appointments by (salon_id, source='naver', external_source_id).
-- Local Playwright session remains on the salon Windows PC. Only normalized booking data is sent here.
-- Never persist Naver password, cookies, storageState, or browser profile contents in Supabase.
