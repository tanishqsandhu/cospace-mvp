-- Phase 8: cofounder bug/edit batch

-- New amenities (booleans on listings). Washer & A/C stay in DB but are hidden in UI.
alter table listings add column if not exists coffee boolean default false;
alter table listings add column if not exists access_24_7 boolean default false;
alter table listings add column if not exists self_checkin boolean default false;
alter table listings add column if not exists private_lock boolean default false;
alter table listings add column if not exists window_view boolean default false;
alter table listings add column if not exists whiteboard boolean default false;
alter table listings add column if not exists phone_booth boolean default false;

-- Role at signup: 'customer' | 'host'
alter table profiles add column if not exists account_type text default 'customer';

-- Building-level photos (separate from per-unit listing_images)
create table if not exists building_images (
  id uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,
  url text not null,
  storage_path text,
  position int default 0,
  created_at timestamptz default now()
);
alter table building_images enable row level security;
drop policy if exists building_images_read on building_images;
create policy building_images_read on building_images for select using (true);
drop policy if exists building_images_write on building_images;
create policy building_images_write on building_images for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- (Blocked dates reuse the existing listings.holiday_dates jsonb column — no new table.)
