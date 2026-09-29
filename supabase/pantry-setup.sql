-- MEANWHILE PANTRY SETUP
-- Paste all of this into the Supabase SQL Editor and click Run. Run it once.
-- It is safe to run again: it never deletes anything.

-- 1. THE PANTRY: every story the AI has checked, with its verdict.
create table if not exists public.story_inventory (
  id              text primary key,          -- short fingerprint of the story link
  url             text not null,
  title           text not null,
  summary         text,
  source          text,                      -- publisher name
  source_url      text,                      -- the feed it came from
  image           text,
  section         text,
  published_at    timestamptz,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  checked_at      timestamptz,
  ai_keep         boolean,
  ai_safe         boolean,
  ai_delight      smallint,
  ai_topic        text,
  ai_reason       text,
  word_blocked    boolean not null default false,
  shelf_until     timestamptz               -- stays in the edition until this time
);

create index if not exists story_inventory_shelf_idx on public.story_inventory (ai_keep, shelf_until desc);
create index if not exists story_inventory_topic_idx on public.story_inventory (ai_topic);
create index if not exists story_inventory_source_idx on public.story_inventory (source_url);

-- 2. THE LOGBOOK: one row per background run, including what it cost.
create table if not exists public.check_runs (
  id           bigint generated always as identity primary key,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  sources      integer,
  fetched      integer,
  new_stories  integer,
  judged       integer,
  kept         integer,
  cost_usd     numeric(10,4) default 0,
  notes        text
);

-- 3. LOCK THE DOORS. Only the server (with the secret key) can read or write
-- these tables. Readers' browsers cannot touch them.
alter table public.story_inventory enable row level security;
alter table public.check_runs enable row level security;
