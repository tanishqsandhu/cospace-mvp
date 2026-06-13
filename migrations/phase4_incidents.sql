-- Phase 4: incident reports tied to a booking
create table if not exists public.incidents (
  id          uuid primary key default uuid_generate_v4(),
  booking_id  uuid references public.bookings(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete set null,
  category    text not null,
  severity    text default 'medium',
  description text,
  status      text default 'open' check (status in ('open','reviewed','resolved')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
-- RLS on; all access goes through service-role API routes (no public policies)
alter table public.incidents enable row level security;
