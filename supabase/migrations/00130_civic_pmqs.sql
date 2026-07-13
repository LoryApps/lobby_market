-- 00130_civic_pmqs.sql
-- Prime Minister's Questions (PMQs):
-- The ruling coalition leader (PM) faces questions from citizens.
-- Citizens submit questions, others upvote the best ones.
-- Selected questions are answered by the PM within a session window.

-- ─── PMQ Sessions ──────────────────────────────────────────────────────────────

create table if not exists pmq_sessions (
  id                uuid        primary key default gen_random_uuid(),
  session_number    int         not null,
  coalition_id      uuid        references coalitions(id) on delete set null,
  pm_user_id        uuid        references profiles(id)   on delete set null,
  title             text        not null default 'Prime Minister''s Questions',
  status            text        not null default 'open'
                                  check (status in ('open','in_progress','closed','archived')),
  questions_due_at  timestamptz not null default (now() + interval '2 days'),
  closes_at         timestamptz not null default (now() + interval '3 days'),
  created_at        timestamptz not null default now()
);

-- ─── PMQ Questions ─────────────────────────────────────────────────────────────

create table if not exists pmq_questions (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null references pmq_sessions(id) on delete cascade,
  asker_id     uuid        not null references profiles(id)      on delete cascade,
  question     text        not null check (char_length(question) between 10 and 280),
  category     text,
  upvotes      int         not null default 0,
  status       text        not null default 'pending'
                             check (status in ('pending','selected','answered','skipped')),
  selected_rank int,
  created_at   timestamptz not null default now(),
  -- One question per citizen per session
  unique (session_id, asker_id)
);

-- ─── PMQ Answers (PM's responses) ─────────────────────────────────────────────

create table if not exists pmq_answers (
  id          uuid        primary key default gen_random_uuid(),
  question_id uuid        not null references pmq_questions(id) on delete cascade unique,
  answer      text        not null check (char_length(answer) between 20 and 1000),
  answered_by uuid        not null references profiles(id)       on delete set null,
  created_at  timestamptz not null default now()
);

-- ─── Upvotes ───────────────────────────────────────────────────────────────────

create table if not exists pmq_question_votes (
  question_id uuid        not null references pmq_questions(id) on delete cascade,
  user_id     uuid        not null references profiles(id)       on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);

-- ─── Vote counter trigger ──────────────────────────────────────────────────────

create or replace function pmq_vote_counter()
returns trigger language plpgsql security definer as $$
begin
  if (TG_OP = 'INSERT') then
    update pmq_questions set upvotes = upvotes + 1 where id = NEW.question_id;
  elsif (TG_OP = 'DELETE') then
    update pmq_questions set upvotes = greatest(0, upvotes - 1) where id = OLD.question_id;
  end if;
  return null;
end;
$$;

drop trigger if exists pmq_question_vote_count on pmq_question_votes;
create trigger pmq_question_vote_count
after insert or delete on pmq_question_votes
for each row execute function pmq_vote_counter();

-- ─── Row-Level Security ────────────────────────────────────────────────────────

alter table pmq_sessions       enable row level security;
alter table pmq_questions      enable row level security;
alter table pmq_answers        enable row level security;
alter table pmq_question_votes enable row level security;

-- Sessions: public read
create policy "pmq_sessions_read"
  on pmq_sessions for select using (true);

-- Questions: public read
create policy "pmq_questions_read"
  on pmq_questions for select using (true);

-- Questions: any authenticated user can submit (one per session enforced by unique)
create policy "pmq_questions_insert"
  on pmq_questions for insert
  with check (auth.uid() = asker_id);

-- Answers: public read
create policy "pmq_answers_read"
  on pmq_answers for select using (true);

-- Answers: only the designated PM may submit
create policy "pmq_answers_insert"
  on pmq_answers for insert
  with check (
    auth.uid() = answered_by
    and exists (
      select 1 from pmq_questions q
      join  pmq_sessions  s on s.id = q.session_id
      where q.id = pmq_answers.question_id
        and s.pm_user_id = auth.uid()
    )
  );

-- Votes: users manage their own votes
create policy "pmq_votes_select" on pmq_question_votes for select using (true);
create policy "pmq_votes_insert" on pmq_question_votes for insert with check (auth.uid() = user_id);
create policy "pmq_votes_delete" on pmq_question_votes for delete using  (auth.uid() = user_id);

-- ─── Seed a demo session ───────────────────────────────────────────────────────
-- (Inserted only once; references the first coalition if any exist)
insert into pmq_sessions (session_number, title, status, questions_due_at, closes_at)
values (
  1,
  'PMQs — Inaugural Session',
  'open',
  now() + interval '2 days',
  now() + interval '3 days'
)
on conflict do nothing;
