-- ── Changemakers ─────────────────────────────────────────────────────────────
-- Stores "what would change my mind" statements from voters.
-- Each user can have at most one statement per topic.
-- Distinct from vote_reasons (why you voted) — this is forward-looking:
-- what evidence/argument would flip your position.

create table if not exists public.topic_changemakers (
  id          uuid        primary key default gen_random_uuid(),
  topic_id    uuid        not null references public.topics(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  current_vote text       not null check (current_vote in ('for', 'against')),
  condition   text        not null check (char_length(condition) between 20 and 500),
  upvotes     int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(topic_id, user_id)
);

create table if not exists public.changemaker_upvotes (
  changemaker_id uuid not null references public.topic_changemakers(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  primary key (changemaker_id, user_id)
);

-- Indexes
create index if not exists topic_changemakers_topic_idx on public.topic_changemakers(topic_id);
create index if not exists topic_changemakers_user_idx  on public.topic_changemakers(user_id);
create index if not exists topic_changemakers_fts        on public.topic_changemakers
  using gin (to_tsvector('english', condition));

-- RLS
alter table public.topic_changemakers  enable row level security;
alter table public.changemaker_upvotes enable row level security;

create policy "Anyone can read changemakers"
  on public.topic_changemakers for select using (true);

create policy "Users can insert own changemaker"
  on public.topic_changemakers for insert
  with check (auth.uid() = user_id);

create policy "Users can update own changemaker"
  on public.topic_changemakers for update
  using (auth.uid() = user_id);

create policy "Users can delete own changemaker"
  on public.topic_changemakers for delete
  using (auth.uid() = user_id);

create policy "Anyone can read changemaker upvotes"
  on public.changemaker_upvotes for select using (true);

create policy "Users can manage own changemaker upvotes"
  on public.changemaker_upvotes for all
  using (auth.uid() = user_id);

-- RPC helpers for upvote counters
create or replace function public.increment_changemaker_upvotes(cid uuid)
returns void language sql security definer as $$
  update public.topic_changemakers set upvotes = upvotes + 1 where id = cid;
$$;

create or replace function public.decrement_changemaker_upvotes(cid uuid)
returns void language sql security definer as $$
  update public.topic_changemakers set upvotes = greatest(0, upvotes - 1) where id = cid;
$$;
