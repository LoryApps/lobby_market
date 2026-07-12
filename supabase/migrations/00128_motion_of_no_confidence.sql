-- 00128_motion_of_no_confidence.sql
-- Allows citizens to table and vote on a formal motion of no confidence
-- in the current civic government (highest-influence coalition).

create table if not exists confidence_motions (
  id            uuid        not null primary key default gen_random_uuid(),
  tabled_by     uuid        not null references profiles(id) on delete cascade,
  reason        text        not null check (char_length(reason) between 10 and 500),
  status        text        not null default 'open'
                              check (status in ('open', 'carried', 'defeated', 'withdrawn')),
  votes_for     int         not null default 0,   -- support no-confidence
  votes_against int         not null default 0,   -- confidence in government
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz not null default now()
);

-- Per-user vote on a confidence motion
create table if not exists confidence_votes (
  motion_id  uuid  not null references confidence_motions(id) on delete cascade,
  user_id    uuid  not null references profiles(id) on delete cascade,
  side       text  not null check (side in ('no_confidence', 'confidence')),
  created_at timestamptz not null default now(),
  primary key (motion_id, user_id)
);

alter table confidence_motions enable row level security;
alter table confidence_votes    enable row level security;

create policy "Anyone can read confidence motions"
  on confidence_motions for select using (true);

create policy "Authenticated users can table motions"
  on confidence_motions for insert
  with check (auth.uid() = tabled_by);

create policy "Authenticated users can update motions"
  on confidence_motions for update
  using (auth.uid() = tabled_by);

create policy "Anyone can read confidence votes"
  on confidence_votes for select using (true);

create policy "Authenticated users can vote"
  on confidence_votes for insert
  with check (auth.uid() = user_id);
