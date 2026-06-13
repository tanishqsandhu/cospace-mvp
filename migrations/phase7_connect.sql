-- Phase 7: Stripe Connect host payouts
alter table profiles add column if not exists stripe_account_id text;
alter table profiles add column if not exists payouts_enabled boolean default false;
alter table bookings add column if not exists host_paid_out boolean default false;
alter table bookings add column if not exists paid_out_at timestamptz;
alter table bookings add column if not exists stripe_transfer_id text;
