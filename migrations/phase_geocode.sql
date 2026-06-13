-- Geocoding: store building coordinates
alter table public.buildings add column if not exists lat double precision;
alter table public.buildings add column if not exists lng double precision;
