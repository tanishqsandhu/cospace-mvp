-- Phase 6: incident resolution center (photos + resolution note + message thread)
alter table public.incidents add column if not exists photos text[] default '{}';
alter table public.incidents add column if not exists resolution_note text;

create table if not exists public.incident_messages (
  id          uuid primary key default uuid_generate_v4(),
  incident_id uuid references public.incidents(id) on delete cascade not null,
  sender_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz default now()
);
alter table public.incident_messages enable row level security;
