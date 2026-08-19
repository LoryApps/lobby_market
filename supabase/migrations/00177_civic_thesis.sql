-- Civic Thesis: personal civic prediction / belief statements
-- Users stake their reputation on a 280-char claim about the future of society.
-- Others can agree or disagree; the author resolves the thesis when time comes.

-- ── Tables ─────────────────────────────────────────────────────────────────────

create table if not exists civic_theses (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references profiles(id) on delete cascade,
  statement        text        not null,
  rationale        text,
  category         text        not null default 'politics',
  resolution_date  timestamptz,
  status           text        not null default 'active',
  related_topic_id uuid        references topics(id) on delete set null,
  agree_count      int         not null default 0,
  disagree_count   int         not null default 0,
  is_public        boolean     not null default true,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint thesis_stmt_len  check (char_length(statement) between 10 and 280),
  constraint thesis_status    check (status in ('active','vindicated','refuted','expired')),
  constraint thesis_category  check (category in (
    'economics','politics','technology','science',
    'ethics','philosophy','culture','health','environment','education'
  ))
);

-- agree / disagree by other users
create table if not exists thesis_votes (
  thesis_id  uuid     not null references civic_theses(id) on delete cascade,
  user_id    uuid     not null references profiles(id) on delete cascade,
  agree      boolean  not null,
  created_at timestamptz not null default now(),
  primary key (thesis_id, user_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

create index if not exists thesis_user_idx     on civic_theses(user_id);
create index if not exists thesis_status_idx   on civic_theses(status);
create index if not exists thesis_created_idx  on civic_theses(created_at desc);
create index if not exists thesis_category_idx on civic_theses(category);
create index if not exists thesis_topic_idx    on civic_theses(related_topic_id)
  where related_topic_id is not null;

-- ── Row-Level Security ─────────────────────────────────────────────────────────

alter table civic_theses enable row level security;
alter table thesis_votes  enable row level security;

create policy "thesis_public_read"
  on civic_theses for select
  using (is_public = true or auth.uid() = user_id);

create policy "thesis_owner_write"
  on civic_theses for insert
  with check (auth.uid() = user_id);

create policy "thesis_owner_update"
  on civic_theses for update
  using (auth.uid() = user_id);

create policy "thesis_owner_delete"
  on civic_theses for delete
  using (auth.uid() = user_id);

create policy "thesis_vote_read"
  on thesis_votes for select
  using (true);

create policy "thesis_vote_insert"
  on thesis_votes for insert
  with check (auth.uid() = user_id);

create policy "thesis_vote_delete"
  on thesis_votes for delete
  using (auth.uid() = user_id);

-- ── Counter triggers ───────────────────────────────────────────────────────────

create or replace function update_thesis_vote_counts()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    if new.agree then
      update civic_theses set agree_count    = agree_count    + 1 where id = new.thesis_id;
    else
      update civic_theses set disagree_count = disagree_count + 1 where id = new.thesis_id;
    end if;
  elsif (tg_op = 'DELETE') then
    if old.agree then
      update civic_theses set agree_count    = greatest(0, agree_count    - 1) where id = old.thesis_id;
    else
      update civic_theses set disagree_count = greatest(0, disagree_count - 1) where id = old.thesis_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger thesis_vote_counter
  after insert or delete on thesis_votes
  for each row execute procedure update_thesis_vote_counts();

-- ── updated_at ────────────────────────────────────────────────────────────────

create or replace function update_civic_thesis_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger civic_thesis_updated_at
  before update on civic_theses
  for each row execute procedure update_civic_thesis_updated_at();
