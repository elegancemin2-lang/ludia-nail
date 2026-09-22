-- LUDIA ART STUDIO · shared INBETWEEN Supabase project / ludia_art_* namespace

create table if not exists public.ludia_art_projects (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.ludia_salons(id) on delete cascade,
  customer_id uuid references public.ludia_customers(id) on delete set null,
  title text not null default '새 네일 디자인',
  purpose text not null default 'customer_consulting' check (purpose in ('customer_consulting','monthly_art','sns','internal')),
  status text not null default 'draft' check (status in ('draft','generating','review','confirmed','archived')),
  tags text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ludia_art_design_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ludia_art_projects(id) on delete cascade,
  version_no integer not null default 1,
  source_type text not null default 'manual' check (source_type in ('manual','generated','imported','template')),
  design_json jsonb not null default '{}'::jsonb,
  preview_image_url text,
  render_status text not null default 'draft' check (render_status in ('draft','queued','rendering','completed','failed')),
  estimated_price integer,
  estimated_duration_min integer,
  created_at timestamptz not null default now(),
  unique(project_id,version_no)
);

create table if not exists public.ludia_art_generation_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ludia_art_projects(id) on delete cascade,
  source_snapshot_id uuid not null references public.ludia_art_design_snapshots(id) on delete restrict,
  mode text not null default 'fresh_6',
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','partial','completed','failed','cancelled')),
  total_items integer not null default 6 check (total_items between 1 and 12),
  completed_items integer not null default 0,
  failed_items integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.ludia_art_generation_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ludia_art_generation_batches(id) on delete cascade,
  variant_index integer not null,
  variant_type text not null,
  seed text not null,
  prompt_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','rendering','completed','failed')),
  output_snapshot_id uuid references public.ludia_art_design_snapshots(id) on delete set null,
  preview_image_url text,
  short_label text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id,variant_index)
);

create index if not exists ludia_art_projects_salon_updated_idx on public.ludia_art_projects(salon_id,updated_at desc);
create index if not exists ludia_art_snapshots_project_idx on public.ludia_art_design_snapshots(project_id,version_no desc);
create index if not exists ludia_art_batches_project_idx on public.ludia_art_generation_batches(project_id,created_at desc);
create index if not exists ludia_art_items_batch_idx on public.ludia_art_generation_items(batch_id,variant_index);

do $$ begin
  create trigger ludia_art_projects_touch before update on public.ludia_art_projects for each row execute function public.ludia_touch_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger ludia_art_items_touch before update on public.ludia_art_generation_items for each row execute function public.ludia_touch_updated_at();
exception when duplicate_object then null; end $$;

revoke all on table public.ludia_art_projects, public.ludia_art_design_snapshots, public.ludia_art_generation_batches, public.ludia_art_generation_items from anon;
grant select,insert,update,delete on table public.ludia_art_projects, public.ludia_art_design_snapshots, public.ludia_art_generation_batches, public.ludia_art_generation_items to authenticated;

alter table public.ludia_art_projects enable row level security;
alter table public.ludia_art_design_snapshots enable row level security;
alter table public.ludia_art_generation_batches enable row level security;
alter table public.ludia_art_generation_items enable row level security;

create policy ludia_art_projects_member_select on public.ludia_art_projects
for select to authenticated using (public.ludia_is_salon_member(salon_id));
create policy ludia_art_projects_member_insert on public.ludia_art_projects
for insert to authenticated with check (public.ludia_is_salon_member(salon_id) and (created_by is null or created_by=(select auth.uid())));
create policy ludia_art_projects_member_update on public.ludia_art_projects
for update to authenticated using (public.ludia_is_salon_member(salon_id)) with check (public.ludia_is_salon_member(salon_id));
create policy ludia_art_projects_manager_delete on public.ludia_art_projects
for delete to authenticated using (public.ludia_is_salon_manager(salon_id));

create policy ludia_art_snapshots_member_all on public.ludia_art_design_snapshots
for all to authenticated
using (exists(select 1 from public.ludia_art_projects p where p.id=project_id and public.ludia_is_salon_member(p.salon_id)))
with check (exists(select 1 from public.ludia_art_projects p where p.id=project_id and public.ludia_is_salon_member(p.salon_id)));

create policy ludia_art_batches_member_all on public.ludia_art_generation_batches
for all to authenticated
using (exists(select 1 from public.ludia_art_projects p where p.id=project_id and public.ludia_is_salon_member(p.salon_id)))
with check (exists(select 1 from public.ludia_art_projects p where p.id=project_id and public.ludia_is_salon_member(p.salon_id)));

create policy ludia_art_items_member_all on public.ludia_art_generation_items
for all to authenticated
using (exists(
  select 1 from public.ludia_art_generation_batches b
  join public.ludia_art_projects p on p.id=b.project_id
  where b.id=batch_id and public.ludia_is_salon_member(p.salon_id)
))
with check (exists(
  select 1 from public.ludia_art_generation_batches b
  join public.ludia_art_projects p on p.id=b.project_id
  where b.id=batch_id and public.ludia_is_salon_member(p.salon_id)
));

do $$ begin alter publication supabase_realtime add table public.ludia_art_generation_batches; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.ludia_art_generation_items; exception when duplicate_object then null; end $$;
