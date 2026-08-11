-- Civic Notes: private per-user notes and annotations
-- Users can attach markdown notes to any topic (or keep them general)
-- All notes are private (only the author can read them)

create table if not exists civic_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  topic_id    uuid references topics(id) on delete set null,
  title       text not null default '',
  content     text not null default '',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Users can only ever see their own notes
alter table civic_notes enable row level security;

create policy "civic_notes_owner_all"
  on civic_notes
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh
create or replace function update_civic_notes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger civic_notes_updated_at
  before update on civic_notes
  for each row execute function update_civic_notes_updated_at();

-- Index for fast user lookups
create index if not exists civic_notes_user_idx
  on civic_notes (user_id, updated_at desc);

create index if not exists civic_notes_topic_idx
  on civic_notes (topic_id)
  where topic_id is not null;

-- Text search index (GIN trigram for ILIKE performance)
create extension if not exists pg_trgm;
create index if not exists civic_notes_title_trgm_idx
  on civic_notes using gin (title gin_trgm_ops);
create index if not exists civic_notes_content_trgm_idx
  on civic_notes using gin (content gin_trgm_ops);
