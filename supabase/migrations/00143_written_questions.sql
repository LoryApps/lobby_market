-- Written Parliamentary Questions (WPQs)
-- Citizens submit formal written questions to civic department leads;
-- officials (elders or top-category users) provide written answers.
-- More formal and archival than AMA sessions; all answers are public record.

create table if not exists civic_written_questions (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references profiles(id) on delete cascade,
  department    text not null,
  question_text text not null check (char_length(question_text) between 20 and 600),
  context_text  text,
  topic_id      uuid references topics(id) on delete set null,
  upvotes       integer not null default 0,
  status        text not null default 'open'
                  check (status in ('open', 'answered', 'declined', 'expired')),
  is_urgent     boolean not null default false,
  answered_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '14 days'),
  created_at    timestamptz not null default now()
);

create table if not exists civic_written_answers (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null unique references civic_written_questions(id) on delete cascade,
  answerer_id  uuid not null references profiles(id) on delete cascade,
  answer_text  text not null check (char_length(answer_text) between 20 and 2000),
  created_at   timestamptz not null default now()
);

create table if not exists civic_written_question_upvotes (
  question_id uuid not null references civic_written_questions(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);

alter table civic_written_questions enable row level security;
alter table civic_written_answers    enable row level security;
alter table civic_written_question_upvotes enable row level security;

create policy "Anyone can read written questions"
  on civic_written_questions for select using (true);

create policy "Logged-in users can create written questions"
  on civic_written_questions for insert
  with check (auth.uid() = author_id);

create policy "Authors can update own questions (status changes by RPC)"
  on civic_written_questions for update
  using (auth.uid() = author_id);

create policy "Anyone can read written answers"
  on civic_written_answers for select using (true);

create policy "Logged-in users can write answers"
  on civic_written_answers for insert
  with check (auth.uid() = answerer_id);

create policy "Anyone can read upvotes"
  on civic_written_question_upvotes for select using (true);

create policy "Logged-in users can upvote"
  on civic_written_question_upvotes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own upvote"
  on civic_written_question_upvotes for delete
  using (auth.uid() = user_id);

-- Indexes
create index if not exists idx_cwq_department  on civic_written_questions (department);
create index if not exists idx_cwq_status      on civic_written_questions (status);
create index if not exists idx_cwq_created_at  on civic_written_questions (created_at desc);
create index if not exists idx_cwq_upvotes     on civic_written_questions (upvotes desc);
create index if not exists idx_cwa_question_id on civic_written_answers   (question_id);
