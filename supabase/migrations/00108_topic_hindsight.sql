-- ── Hindsight ─────────────────────────────────────────────────────────────────
-- Post-resolution retrospective votes: did the community make the right call?
-- Only visible / submittable once a topic has status = 'law' or 'failed'.
-- Each user can submit one hindsight vote per topic, updatable at any time.

create table if not exists public.topic_hindsight_votes (
  id         uuid        primary key default gen_random_uuid(),
  topic_id   uuid        not null references public.topics(id) on delete cascade,
  user_id    uuid        not null references auth.users(id)    on delete cascade,
  verdict    text        not null check (verdict in ('right', 'wrong')),
  note       text        check (note is null or (char_length(note) between 1 and 200)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(topic_id, user_id)
);

create index if not exists topic_hindsight_topic_idx on public.topic_hindsight_votes(topic_id);
create index if not exists topic_hindsight_user_idx  on public.topic_hindsight_votes(user_id);

alter table public.topic_hindsight_votes enable row level security;

create policy "Anyone can read hindsight votes"
  on public.topic_hindsight_votes for select using (true);

create policy "Users can insert their own hindsight vote"
  on public.topic_hindsight_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own hindsight vote"
  on public.topic_hindsight_votes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own hindsight vote"
  on public.topic_hindsight_votes for delete
  using (auth.uid() = user_id);
