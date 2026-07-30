-- 00168_law_challenges.sql
-- Formal challenges to established laws.
-- Citizens can file challenges on specific grounds, and others can vote
-- on whether the challenge has merit.

create type law_challenge_grounds as enum (
  'constitutional',
  'procedural',
  'factual',
  'ethical',
  'practical'
);

create type law_challenge_status as enum (
  'open',
  'upheld',
  'dismissed'
);

create table if not exists law_challenges (
  id            uuid primary key default gen_random_uuid(),
  law_id        uuid not null references laws(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  grounds       law_challenge_grounds not null,
  title         text not null check (char_length(title) between 10 and 120),
  description   text not null check (char_length(description) between 30 and 1200),
  status        law_challenge_status not null default 'open',
  support_count int  not null default 0,
  oppose_count  int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists law_challenge_votes (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references law_challenges(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  vote         text not null check (vote in ('support', 'oppose')),
  created_at   timestamptz not null default now(),
  unique (challenge_id, user_id)
);

-- Indexes
create index if not exists law_challenges_law_id_idx     on law_challenges(law_id);
create index if not exists law_challenges_user_id_idx    on law_challenges(user_id);
create index if not exists law_challenges_grounds_idx    on law_challenges(grounds);
create index if not exists law_challenge_votes_chall_idx on law_challenge_votes(challenge_id);

-- Keep support/oppose counts in sync
create or replace function update_law_challenge_counts()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.vote = 'support' then
      update law_challenges set support_count = support_count + 1, updated_at = now() where id = NEW.challenge_id;
    else
      update law_challenges set oppose_count  = oppose_count  + 1, updated_at = now() where id = NEW.challenge_id;
    end if;
  elsif TG_OP = 'DELETE' then
    if OLD.vote = 'support' then
      update law_challenges set support_count = greatest(0, support_count - 1), updated_at = now() where id = OLD.challenge_id;
    else
      update law_challenges set oppose_count  = greatest(0, oppose_count  - 1), updated_at = now() where id = OLD.challenge_id;
    end if;
  elsif TG_OP = 'UPDATE' then
    -- vote flipped
    if OLD.vote = 'support' and NEW.vote = 'oppose' then
      update law_challenges set support_count = greatest(0, support_count - 1),
                                oppose_count  = oppose_count + 1, updated_at = now()
      where id = NEW.challenge_id;
    elsif OLD.vote = 'oppose' and NEW.vote = 'support' then
      update law_challenges set oppose_count  = greatest(0, oppose_count  - 1),
                                support_count = support_count + 1, updated_at = now()
      where id = NEW.challenge_id;
    end if;
  end if;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists law_challenge_vote_counter on law_challenge_votes;
create trigger law_challenge_vote_counter
after insert or update or delete on law_challenge_votes
for each row execute function update_law_challenge_counts();

-- RLS
alter table law_challenges       enable row level security;
alter table law_challenge_votes  enable row level security;

create policy "Anyone can read challenges"      on law_challenges       for select using (true);
create policy "Auth users can file challenges"  on law_challenges       for insert with check (auth.uid() = user_id);
create policy "Authors can update own"          on law_challenges       for update using (auth.uid() = user_id);

create policy "Anyone can read votes"           on law_challenge_votes  for select using (true);
create policy "Auth users can vote"             on law_challenge_votes  for insert with check (auth.uid() = user_id);
create policy "Auth users can change vote"      on law_challenge_votes  for update using (auth.uid() = user_id);
create policy "Auth users can withdraw vote"    on law_challenge_votes  for delete using (auth.uid() = user_id);
