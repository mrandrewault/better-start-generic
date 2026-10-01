-- MEANWHILE SOCIAL SETUP
-- Paste all of this into the Supabase SQL Editor and click Run. Run it once.
-- It is safe to run again: it never deletes anything.

-- THE SOCIAL LOG: every story the social robot planned or sent to Buffer,
-- so a story is never posted twice.
create table if not exists public.social_posts (
  id               bigint generated always as identity primary key,
  story_id         text not null,            -- the pantry story
  batch            text not null,            -- the day (or "preview-...")
  status           text not null,            -- preview, picked or drafted
  card_line        text,                     -- the headline on the card
  palette          text,                     -- the four card colors
  caption          text,                     -- Instagram and TikTok caption
  threads_caption  text,
  topic            text,
  source           text,
  title            text,
  url              text,
  buffer_ids       jsonb,
  error            text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

create index if not exists social_posts_story_idx on public.social_posts (story_id);
create index if not exists social_posts_created_idx on public.social_posts (created_at desc);

-- LOCK THE DOORS. Only the server (with the secret key) can read or write it.
alter table public.social_posts enable row level security;
