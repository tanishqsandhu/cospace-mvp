-- Phase 2: approval workflow + payout fields
-- Safe to run multiple times.

-- 1) Widen booking status values (drop any existing status check, add the full set)
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute 'alter table public.bookings drop constraint ' || quote_ident(c);
  end loop;
end $$;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending','awaiting_approval','confirmed','cancelled','completed'));

-- 2) Track when a host responded to a request
alter table public.bookings add column if not exists responded_at timestamptz;

-- 3) Host payout details on profile
alter table public.profiles add column if not exists payout_method  text;
alter table public.profiles add column if not exists payout_account text;
alter table public.profiles add column if not exists payout_name    text;
