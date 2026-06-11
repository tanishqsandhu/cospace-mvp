-- ═══════════════════════════════════════════════════════════════════════════
-- CoSpace MVP — Supabase Schema
-- Paste this entire file into: Supabase dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Users (extends Supabase auth.users) ──────────────────────────────────────
create table public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  email         text unique not null,
  first_name    text,
  last_name     text,
  avatar_url    text,
  phone         text,
  about         text,
  country       text,
  address       text,
  city          text,
  state         text,
  zip_code      text,
  is_host       boolean default false,
  is_email_verified boolean default false,
  profile_completed boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Listings (was "places") ───────────────────────────────────────────────────
create table public.listings (
  id            uuid primary key default uuid_generate_v4(),
  host_id       uuid references public.profiles(id) on delete cascade not null,

  -- Type: 'entire place', 'room', 'shared room' (kept from old code)
  type          text not null,

  -- Location
  country       text,
  address       text,
  address_etc   text,
  city          text,
  state         text,
  zip_code      text,

  -- Amenities (kept all from old codebase)
  wifi          boolean default false,
  tv            boolean default false,
  kitchen       boolean default false,
  washer        boolean default false,
  free_parking  boolean default false,
  paid_parking  boolean default false,
  air_conditioning boolean default false,
  workspace     boolean default false,

  -- Details
  description   text,
  price         numeric(10,2),                -- base daily price
  opening_time  time,
  closing_time  time,

  -- Per-day special pricing [{startDate, endDate, price}]
  per_day_offers jsonb default '[]'::jsonb,

  -- Blocked/holiday dates [{startDate, endDate}]
  holiday_dates jsonb default '[]'::jsonb,

  -- Status
  is_published    boolean default false,
  admin_approved  boolean default false,

  -- Denormalised stats (updated by triggers)
  avg_rating    numeric(3,2) default 0,
  review_count  int default 0,
  total_views   int default 0,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Listing images (separate table, no more base64 strings) ──────────────────
create table public.listing_images (
  id          uuid primary key default uuid_generate_v4(),
  listing_id  uuid references public.listings(id) on delete cascade not null,
  storage_path text not null,  -- path in Supabase Storage bucket
  url         text not null,   -- public URL
  position    int default 0,
  created_at  timestamptz default now()
);

-- ── Bookings (was "reserve") ──────────────────────────────────────────────────
create table public.bookings (
  id            uuid primary key default uuid_generate_v4(),
  listing_id    uuid references public.listings(id) on delete restrict not null,
  guest_id      uuid references public.profiles(id) on delete restrict not null,
  host_id       uuid references public.profiles(id) on delete restrict not null,

  start_date    date not null,
  end_date      date not null,
  slots         int default 1,
  per_day_price numeric(10,2) not null,
  total_days    int not null,
  total_price   numeric(10,2) not null,

  -- Status lifecycle
  status        text default 'confirmed'
                check (status in ('confirmed','cancelled','completed')),

  -- Stripe
  stripe_payment_intent_id text,
  stripe_session_id text,
  paid          boolean default false,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── Reviews ───────────────────────────────────────────────────────────────────
create table public.reviews (
  id          uuid primary key default uuid_generate_v4(),
  listing_id  uuid references public.listings(id) on delete cascade not null,
  booking_id  uuid references public.bookings(id) on delete set null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  rating      int not null check (rating between 1 and 5),
  review      text,
  created_at  timestamptz default now()
);

-- ── Listing views (daily counter) ─────────────────────────────────────────────
create table public.listing_views (
  id          uuid primary key default uuid_generate_v4(),
  listing_id  uuid references public.listings(id) on delete cascade not null,
  view_date   date not null default current_date,
  count       int default 1,
  unique(listing_id, view_date)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles        enable row level security;
alter table public.listings         enable row level security;
alter table public.listing_images   enable row level security;
alter table public.bookings         enable row level security;
alter table public.reviews          enable row level security;
alter table public.listing_views    enable row level security;

-- Profiles: users can read all, only update their own
create policy "profiles_public_read"  on public.profiles for select using (true);
create policy "profiles_own_update"   on public.profiles for update using (auth.uid() = id);
create policy "profiles_own_insert"   on public.profiles for insert with check (auth.uid() = id);

-- Listings: anyone can read published, hosts manage their own
create policy "listings_public_read"  on public.listings for select using (is_published = true or host_id = auth.uid());
create policy "listings_host_insert"  on public.listings for insert with check (host_id = auth.uid());
create policy "listings_host_update"  on public.listings for update using (host_id = auth.uid());
create policy "listings_host_delete"  on public.listings for delete using (host_id = auth.uid());

-- Listing images
create policy "images_public_read"    on public.listing_images for select using (true);
create policy "images_host_manage"    on public.listing_images for all using (
  exists (select 1 from public.listings l where l.id = listing_id and l.host_id = auth.uid())
);

-- Bookings: guest or host can see their own
create policy "bookings_participant_read" on public.bookings for select
  using (guest_id = auth.uid() or host_id = auth.uid());
create policy "bookings_guest_insert" on public.bookings for insert
  with check (guest_id = auth.uid());
create policy "bookings_participant_update" on public.bookings for update
  using (guest_id = auth.uid() or host_id = auth.uid());

-- Reviews: anyone can read, authenticated users can write
create policy "reviews_public_read"   on public.reviews for select using (true);
create policy "reviews_auth_insert"   on public.reviews for insert with check (auth.uid() = reviewer_id);

-- Views: anyone can read, service role upserts
create policy "views_public_read"     on public.listing_views for select using (true);
create policy "views_service_upsert"  on public.listing_views for all using (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- Functions & Triggers
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update listing avg_rating after review insert
create or replace function public.update_listing_rating()
returns trigger language plpgsql as $$
begin
  update public.listings
  set
    avg_rating   = (select avg(rating) from public.reviews where listing_id = new.listing_id),
    review_count = (select count(*) from public.reviews where listing_id = new.listing_id)
  where id = new.listing_id;
  return new;
end;
$$;

create trigger on_review_insert
  after insert on public.reviews
  for each row execute procedure public.update_listing_rating();

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage bucket for listing images
-- ═══════════════════════════════════════════════════════════════════════════
-- Run this separately in the Supabase Storage section, or via SQL:
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict do nothing;

create policy "listing_images_public_read" on storage.objects
  for select using (bucket_id = 'listing-images');

create policy "listing_images_auth_upload" on storage.objects
  for insert with check (bucket_id = 'listing-images' and auth.uid() is not null);

create policy "listing_images_owner_delete" on storage.objects
  for delete using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);
