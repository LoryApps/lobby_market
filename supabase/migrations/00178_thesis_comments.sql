-- Thesis comments: discussion threads on civic theses
-- Allows users to explain their agree/disagree position or add context.

create table if not exists thesis_comments (
  id         uuid        primary key default gen_random_uuid(),
  thesis_id  uuid        not null references civic_theses(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now(),

  constraint thesis_comment_len check (char_length(body) between 1 and 1000)
);

create index if not exists thesis_comments_thesis_idx on thesis_comments(thesis_id, created_at);
create index if not exists thesis_comments_user_idx   on thesis_comments(user_id);

alter table thesis_comments enable row level security;

create policy "thesis_comments_read"
  on thesis_comments for select
  using (true);

create policy "thesis_comments_insert"
  on thesis_comments for insert
  with check (auth.uid() = user_id);

create policy "thesis_comments_delete"
  on thesis_comments for delete
  using (auth.uid() = user_id);
