-- 00070_argument_faceoffs.sql
-- Head-to-head argument matchup votes for the Argument Arena feature.
-- Each row records a user choosing one argument over another in a 1-vs-1
-- "which is more compelling?" round.  Aggregate win counts form the
-- Arena leaderboard — distinct from upvotes (quality) and AI scores (rubric).

create table if not exists argument_faceoff_votes (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  argument_a_id uuid        not null references topic_arguments(id) on delete cascade,
  argument_b_id uuid        not null references topic_arguments(id) on delete cascade,
  winner_id     uuid        not null references topic_arguments(id) on delete cascade,
  created_at    timestamptz not null default now(),
  -- Canonical: always store lower UUID first so the pair is unique regardless
  -- of which argument was displayed on the left.
  constraint faceoff_pair_user_unique unique (user_id, argument_a_id, argument_b_id),
  -- winner must be one of the two arguments
  constraint faceoff_winner_valid check (winner_id = argument_a_id or winner_id = argument_b_id)
);

-- Index for aggregating win counts per argument
create index if not exists argument_faceoff_votes_winner_idx
  on argument_faceoff_votes (winner_id);

-- Index for loading a user's recent matchup history (daily limit check)
create index if not exists argument_faceoff_votes_user_date_idx
  on argument_faceoff_votes (user_id, created_at desc);

-- Index for checking if a specific pair was already seen by a user
create index if not exists argument_faceoff_votes_pair_idx
  on argument_faceoff_votes (argument_a_id, argument_b_id);

alter table argument_faceoff_votes enable row level security;

create policy "Users insert own faceoff votes"
  on argument_faceoff_votes for insert
  with check (auth.uid() = user_id);

create policy "Anyone reads faceoff votes"
  on argument_faceoff_votes for select
  using (true);

-- Convenience view: per-argument arena stats
create or replace view argument_arena_stats as
  select
    a.id as argument_id,
    count(distinct w.id)  filter (where w.winner_id = a.id) as wins,
    count(distinct v.id)  filter (where v.argument_a_id = a.id or v.argument_b_id = a.id) as bouts,
    round(
      100.0 * count(distinct w.id) filter (where w.winner_id = a.id)
      / nullif(count(distinct v.id) filter (where v.argument_a_id = a.id or v.argument_b_id = a.id), 0)
    , 1) as win_pct
  from topic_arguments a
  left join argument_faceoff_votes v
    on v.argument_a_id = a.id or v.argument_b_id = a.id
  left join argument_faceoff_votes w
    on w.winner_id = a.id
  group by a.id;
