-- Civic Questions Time
-- Westminster-style PMQs: citizens formally question Shadow Cabinet ministers
-- on their voting record, stances, and category leadership.

-- ─── Questions ───────────────────────────────────────────────────────────────

create table if not exists civic_minister_questions (
  id            uuid primary key default gen_random_uuid(),
  questioner_id uuid not null references auth.users(id) on delete cascade,
  minister_id   uuid not null references auth.users(id) on delete cascade,
  category      text not null,
  question_text text not null check (char_length(question_text) between 20 and 500),
  context_text  text,                      -- optional context / motivation
  topic_id      uuid references topics(id) on delete set null,
  upvote_count  int not null default 0,
  status        text not null default 'open'
                  check (status in ('open', 'answered', 'declined', 'expired')),
  is_public     boolean not null default true,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  answered_at   timestamptz
);

-- ─── Upvotes ─────────────────────────────────────────────────────────────────

create table if not exists civic_question_upvotes (
  question_id uuid not null references civic_minister_questions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);

-- ─── Minister answers ─────────────────────────────────────────────────────────

create table if not exists civic_minister_answers (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null unique references civic_minister_questions(id) on delete cascade,
  minister_id  uuid not null references auth.users(id) on delete cascade,
  answer_text  text not null check (char_length(answer_text) between 10 and 1000),
  topic_links  text[] default '{}',        -- referenced topic IDs
  upvote_count int not null default 0,
  created_at   timestamptz not null default now()
);

-- ─── Answer upvotes ───────────────────────────────────────────────────────────

create table if not exists civic_answer_upvotes (
  answer_id  uuid not null references civic_minister_answers(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists civic_minister_questions_minister_id_idx
  on civic_minister_questions(minister_id);
create index if not exists civic_minister_questions_status_idx
  on civic_minister_questions(status);
create index if not exists civic_minister_questions_category_idx
  on civic_minister_questions(category);
create index if not exists civic_minister_questions_created_at_idx
  on civic_minister_questions(created_at desc);
create index if not exists civic_minister_questions_upvote_count_idx
  on civic_minister_questions(upvote_count desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table civic_minister_questions enable row level security;
alter table civic_question_upvotes enable row level security;
alter table civic_minister_answers enable row level security;
alter table civic_answer_upvotes enable row level security;

-- Questions: public read, authenticated insert, own delete
create policy "questions_select" on civic_minister_questions
  for select using (is_public = true or auth.uid() = questioner_id or auth.uid() = minister_id);

create policy "questions_insert" on civic_minister_questions
  for insert with check (auth.uid() = questioner_id);

create policy "questions_update" on civic_minister_questions
  for update using (auth.uid() = minister_id);

create policy "questions_delete" on civic_minister_questions
  for delete using (auth.uid() = questioner_id);

-- Question upvotes
create policy "question_upvotes_select" on civic_question_upvotes
  for select using (true);

create policy "question_upvotes_insert" on civic_question_upvotes
  for insert with check (auth.uid() = user_id);

create policy "question_upvotes_delete" on civic_question_upvotes
  for delete using (auth.uid() = user_id);

-- Answers: public read, minister insert
create policy "answers_select" on civic_minister_answers
  for select using (true);

create policy "answers_insert" on civic_minister_answers
  for insert with check (auth.uid() = minister_id);

-- Answer upvotes
create policy "answer_upvotes_select" on civic_answer_upvotes
  for select using (true);

create policy "answer_upvotes_insert" on civic_answer_upvotes
  for insert with check (auth.uid() = user_id);

create policy "answer_upvotes_delete" on civic_answer_upvotes
  for delete using (auth.uid() = user_id);

-- ─── Upvote counter functions ─────────────────────────────────────────────────

create or replace function increment_question_upvote()
returns trigger language plpgsql security definer as $$
begin
  update civic_minister_questions
  set upvote_count = upvote_count + 1
  where id = NEW.question_id;
  return NEW;
end;
$$;

create or replace function decrement_question_upvote()
returns trigger language plpgsql security definer as $$
begin
  update civic_minister_questions
  set upvote_count = greatest(0, upvote_count - 1)
  where id = OLD.question_id;
  return OLD;
end;
$$;

create or replace function increment_answer_upvote()
returns trigger language plpgsql security definer as $$
begin
  update civic_minister_answers
  set upvote_count = upvote_count + 1
  where id = NEW.answer_id;
  return NEW;
end;
$$;

create or replace function decrement_answer_upvote()
returns trigger language plpgsql security definer as $$
begin
  update civic_minister_answers
  set upvote_count = greatest(0, upvote_count - 1)
  where id = OLD.answer_id;
  return OLD;
end;
$$;

create trigger trg_question_upvote_inc
  after insert on civic_question_upvotes
  for each row execute function increment_question_upvote();

create trigger trg_question_upvote_dec
  after delete on civic_question_upvotes
  for each row execute function decrement_question_upvote();

create trigger trg_answer_upvote_inc
  after insert on civic_answer_upvotes
  for each row execute function increment_answer_upvote();

create trigger trg_answer_upvote_dec
  after delete on civic_answer_upvotes
  for each row execute function decrement_answer_upvote();

-- ─── Mark question answered when answer is posted ────────────────────────────

create or replace function mark_question_answered()
returns trigger language plpgsql security definer as $$
begin
  update civic_minister_questions
  set status = 'answered', answered_at = now()
  where id = NEW.question_id;
  return NEW;
end;
$$;

create trigger trg_mark_question_answered
  after insert on civic_minister_answers
  for each row execute function mark_question_answered();
