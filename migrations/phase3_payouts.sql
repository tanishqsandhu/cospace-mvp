-- Phase 3: payout tracking on bookings
alter table public.bookings add column if not exists host_paid_out boolean default false;
alter table public.bookings add column if not exists paid_out_at   timestamptz;
