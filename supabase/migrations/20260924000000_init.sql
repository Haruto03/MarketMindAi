-- MarketMind AI schema.
--
-- The browser only uses Supabase for authentication. All data access goes
-- through the Express API (server/), which verifies the user's JWT and uses
-- the service-role key. RLS is enabled on every table with no policies for
-- the anon/authenticated roles, so the public API key cannot read or write
-- any of this data directly.

-- Saved persona cohorts that can be re-used across simulations.
-- personas holds demographics/background only (no responses).
create table public.panels (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  customer_data jsonb not null,
  personas      jsonb not null,
  created_at    timestamptz not null default now()
);
create index panels_user_created_idx on public.panels (user_id, created_at desc);

-- Completed simulations.
create table public.runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  panel_id      uuid references public.panels (id) on delete set null,
  customer_data jsonb not null,
  personas      jsonb not null,
  report        text not null,
  -- Interview transcripts keyed by persona index
  chats         jsonb not null default '{}'::jsonb,
  -- Set when the owner enables a public read-only share link
  share_id      uuid unique,
  created_at    timestamptz not null default now()
);
create index runs_user_created_idx on public.runs (user_id, created_at desc);

-- One row per billable AI call, for persistent per-user and global limits.
create table public.usage_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('simulation', 'chat')),
  created_at timestamptz not null default now()
);
create index usage_events_user_kind_created_idx on public.usage_events (user_id, kind, created_at desc);
create index usage_events_kind_created_idx on public.usage_events (kind, created_at desc);

alter table public.panels       enable row level security;
alter table public.runs         enable row level security;
alter table public.usage_events enable row level security;

-- Deny-by-default: revoke table privileges from the client roles as well.
revoke all on public.panels, public.runs, public.usage_events from anon, authenticated;
