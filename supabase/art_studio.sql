-- LUDIA ART STUDIO: production-ready project/snapshot/generation model
-- Apply after auth is enabled. RLS intentionally requires authenticated ownership.
create extension if not exists pgcrypto;

create table if not exists public.art_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid,
  title text not null default '새 네일 디자인',
  purpose text not null default 'customer_consulting' check (purpose in ('customer_consulting','monthly_art','sns','internal')),
  status text not null default 'draft' check (status in ('draft','generating','review','confirmed','archived')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.art_design_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.art_projects(id) on delete cascade,
  version_no integer not null default 1,
  source_type text not null default 'manual' check (source_type in ('manual','generated','imported','template')),
  design_json jsonb not null default '{}'::jsonb,
  preview_image_url text,
  render_status text not null default 'draft' check (render_status in ('draft','queued','rendering','completed','failed')),
  estimated_price integer,
  estimated_duration_min integer,
  created_at timestamptz not null default now(),
  unique(project_id, version_no)
);

create table if not exists public.art_generation_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.art_projects(id) on delete cascade,
  source_snapshot_id uuid not null references public.art_design_snapshots(id) on delete restrict,
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

create table if not exists public.art_generation_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.art_generation_batches(id) on delete cascade,
  variant_index integer not null,
  variant_type text not null,
  seed text not null,
  prompt_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','rendering','completed','failed')),
  output_snapshot_id uuid references public.art_design_snapshots(id) on delete set null,
  preview_image_url text,
  short_label text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(batch_id, variant_index)
);

create index if not exists art_projects_owner_updated_idx on public.art_projects(owner_id, updated_at desc);
create index if not exists art_snapshots_project_idx on public.art_design_snapshots(project_id, version_no desc);
create index if not exists art_batches_project_idx on public.art_generation_batches(project_id, created_at desc);
create index if not exists art_items_batch_idx on public.art_generation_items(batch_id, variant_index);

alter table public.art_projects enable row level security;
alter table public.art_design_snapshots enable row level security;
alter table public.art_generation_batches enable row level security;
alter table public.art_generation_items enable row level security;

create policy "art_projects_owner_all" on public.art_projects for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "art_snapshots_owner_all" on public.art_design_snapshots for all using (exists (select 1 from public.art_projects p where p.id = project_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.art_projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "art_batches_owner_all" on public.art_generation_batches for all using (exists (select 1 from public.art_projects p where p.id = project_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.art_projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "art_items_owner_all" on public.art_generation_items for all using (exists (select 1 from public.art_generation_batches b join public.art_projects p on p.id=b.project_id where b.id = batch_id and p.owner_id = auth.uid())) with check (exists (select 1 from public.art_generation_batches b join public.art_projects p on p.id=b.project_id where b.id = batch_id and p.owner_id = auth.uid()));

-- Realtime: generation slots can update one-by-one as rendering completes.
do $$ begin
  alter publication supabase_realtime add table public.art_generation_batches;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.art_generation_items;
exception when duplicate_object then null; end $$;

comment on table public.art_generation_batches is 'Every Create 6 action creates a new immutable batch; saved history is never reused as a generation result.';
comment on column public.art_generation_items.seed is 'Unique per item/batch so repeated generation requests produce fresh variants.';
