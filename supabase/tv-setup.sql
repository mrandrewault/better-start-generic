-- MEANWHILE TV SETUP
-- Paste all of this into the Supabase SQL Editor and click Run. Run it once.
-- It is safe to run again: it never deletes anything.

-- 1. THE CHANNEL BOOK: YouTube channels we looked up by @handle.
create table if not exists public.video_channels (
  key          text primary key,               -- the @handle, lowercase
  handle       text,
  channel_id   text,                           -- YouTube's id for the channel
  title        text,
  tv_channel   text,                           -- animals, music, makers...
  error        text,                           -- why a lookup failed
  checked_at   timestamptz default now()
);

-- 2. THE VIDEO PANTRY: every video the AI has checked, with its verdict.
create table if not exists public.video_inventory (
  id            text primary key,              -- YouTube video id
  title         text,
  description   text,
  channel_name  text,
  channel_id    text,
  source_key    text,
  published_at  timestamptz,
  thumbnail     text,
  views         bigint,
  first_seen_at timestamptz not null default now(),
  checked_at    timestamptz,
  ai_keep       boolean,
  ai_safe       boolean,
  ai_delight    smallint,
  tv_channel    text,
  place         text,                          -- "Norway", "Kyoto, Japan"
  intro         text,                          -- "in Norway, a baker builds..."
  ai_reason     text,
  shelf_until   timestamptz
);
create index if not exists video_inventory_shelf_idx on public.video_inventory (ai_keep, tv_channel, shelf_until desc);
create index if not exists video_inventory_source_idx on public.video_inventory (source_key);

-- 3. THE LOGBOOK: one row per background run, with what it cost.
create table if not exists public.video_runs (
  id           bigint generated always as identity primary key,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  sources      integer,
  fetched      integer,
  new_videos   integer,
  judged       integer,
  kept         integer,
  cost_usd     numeric(10,4) default 0,
  notes        text
);

-- 4. LOCK THE DOORS. Only the server (with the secret key) can read or write.
alter table public.video_channels enable row level security;
alter table public.video_inventory enable row level security;
alter table public.video_runs enable row level security;
