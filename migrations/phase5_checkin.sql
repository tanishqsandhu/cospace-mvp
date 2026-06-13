-- Phase 5: booking check-in via QR
alter table public.bookings add column if not exists checked_in_at timestamptz;
