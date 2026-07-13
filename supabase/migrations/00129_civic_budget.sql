-- 00129_civic_budget.sql
-- The Civic Budget: the governing coalition proposes an annual allocation
-- of civic resources across the 10 categories. Citizens vote to approve
-- or reject the budget. If rejected, the government must revise and resubmit.

-- ─── Budget ───────────────────────────────────────────────────────────────────

create table if not exists civic_budgets (
  id             uuid primary key default gen_random_uuid(),
  coalition_id   uuid references coalitions(id) on delete set null,
  fiscal_year    int  not null,
  title          text not null check (char_length(title) between 5 and 120),
  chancellor_statement text,          -- opening statement from the "chancellor"
  status         text not null default 'proposed'
                   check (status in ('proposed','debating','passed','failed','withdrawn')),
  votes_approve  int  not null default 0,
  votes_reject   int  not null default 0,
  debate_ends_at timestamptz,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique(fiscal_year, coalition_id)
);

-- ─── Budget lines (one per category) ─────────────────────────────────────────

create table if not exists civic_budget_lines (
  id            uuid    primary key default gen_random_uuid(),
  budget_id     uuid    not null references civic_budgets(id) on delete cascade,
  category      text    not null,
  allocation    numeric(5,2) not null check (allocation >= 0 and allocation <= 100),
  description   text    not null check (char_length(description) between 10 and 400),
  change_pct    numeric(6,2) default 0,   -- positive = increase, negative = cut
  priority_rank int     not null default 5 check (priority_rank between 1 and 10),
  created_at    timestamptz not null default now(),
  unique(budget_id, category)
);

-- ─── Budget votes ─────────────────────────────────────────────────────────────

create table if not exists civic_budget_votes (
  budget_id  uuid not null references civic_budgets(id) on delete cascade,
  user_id    uuid not null references profiles(id)  on delete cascade,
  side       text not null check (side in ('approve','reject')),
  reason     text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (budget_id, user_id)
);

-- ─── Budget amendments (opposition counter-proposals) ─────────────────────────

create table if not exists civic_budget_amendments (
  id           uuid primary key default gen_random_uuid(),
  budget_id    uuid not null references civic_budgets(id) on delete cascade,
  proposed_by  uuid not null references profiles(id) on delete cascade,
  category     text not null,
  proposed_pct numeric(5,2) not null check (proposed_pct >= 0 and proposed_pct <= 100),
  rationale    text not null check (char_length(rationale) between 10 and 400),
  upvote_count int  not null default 0,
  status       text not null default 'proposed'
                 check (status in ('proposed','accepted','rejected')),
  created_at   timestamptz not null default now()
);

create table if not exists civic_budget_amendment_votes (
  amendment_id uuid not null references civic_budget_amendments(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (amendment_id, user_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table civic_budgets              enable row level security;
alter table civic_budget_lines         enable row level security;
alter table civic_budget_votes         enable row level security;
alter table civic_budget_amendments    enable row level security;
alter table civic_budget_amendment_votes enable row level security;

create policy "public_read_budgets"
  on civic_budgets for select using (true);
create policy "public_read_budget_lines"
  on civic_budget_lines for select using (true);
create policy "public_read_budget_votes"
  on civic_budget_votes for select using (true);
create policy "public_read_budget_amendments"
  on civic_budget_amendments for select using (true);
create policy "public_read_budget_amendment_votes"
  on civic_budget_amendment_votes for select using (true);

create policy "auth_insert_budget_vote"
  on civic_budget_votes for insert
  with check (auth.uid() = user_id);

create policy "auth_insert_amendment"
  on civic_budget_amendments for insert
  with check (auth.uid() = proposed_by);

create policy "auth_upvote_amendment"
  on civic_budget_amendment_votes for insert
  with check (auth.uid() = user_id);

-- Increments on vote
create or replace function increment_budget_vote()
returns trigger language plpgsql security definer as $$
begin
  if NEW.side = 'approve' then
    update civic_budgets set votes_approve = votes_approve + 1 where id = NEW.budget_id;
  else
    update civic_budgets set votes_reject = votes_reject + 1 where id = NEW.budget_id;
  end if;
  return NEW;
end;
$$;

create trigger budget_vote_counter
  after insert on civic_budget_votes
  for each row execute function increment_budget_vote();

create or replace function increment_amendment_upvote()
returns trigger language plpgsql security definer as $$
begin
  update civic_budget_amendments set upvote_count = upvote_count + 1 where id = NEW.amendment_id;
  return NEW;
end;
$$;

create trigger amendment_upvote_counter
  after insert on civic_budget_amendment_votes
  for each row execute function increment_amendment_upvote();
