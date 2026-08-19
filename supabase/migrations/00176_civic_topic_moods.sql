-- Civic Topic Moods
-- Users express how a civic topic makes them feel.
-- One mood per user per topic (upsertable). Aggregate into per-topic and
-- platform-wide emotional profiles that surface alongside vote data.

create table if not exists civic_topic_moods (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  topic_id   uuid        not null references topics(id)     on delete cascade,
  mood       text        not null
             check (mood in (
               'hopeful','inspired','proud','determined',
               'frustrated','worried','angry','relieved'
             )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);

alter table civic_topic_moods enable row level security;

-- Users can read all mood counts (aggregates) — public
create policy "moods_public_read"
  on civic_topic_moods for select
  using (true);

-- Only the owner can insert / update their mood
create policy "moods_owner_write"
  on civic_topic_moods for insert
  with check (auth.uid() = user_id);

create policy "moods_owner_update"
  on civic_topic_moods for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "moods_owner_delete"
  on civic_topic_moods for delete
  using (auth.uid() = user_id);

-- Keep updated_at fresh on upsert
create or replace function update_civic_topic_moods_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger civic_topic_moods_updated_at
  before update on civic_topic_moods
  for each row execute function update_civic_topic_moods_updated_at();

-- Fast lookup: all moods for a topic
create index if not exists civic_topic_moods_topic_idx
  on civic_topic_moods (topic_id, mood);

-- Fast lookup: user's mood on a topic
create index if not exists civic_topic_moods_user_topic_idx
  on civic_topic_moods (user_id, topic_id);

-- Fast platform-wide aggregation
create index if not exists civic_topic_moods_mood_time_idx
  on civic_topic_moods (mood, created_at desc);
