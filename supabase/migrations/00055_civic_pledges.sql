-- Civic Pledges: public personal commitments to civic actions
-- Users can pledge to take specific civic steps; others can "witness" to
-- provide social accountability. Completed pledges earn Clout.

-- ── Tables ─────────────────────────────────────────────────────────────────────

create table if not exists civic_pledges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  title         text not null,          -- "I pledge to..."
  description   text,                   -- optional elaboration
  category      text not null default 'participation',
  -- participation | advocacy | debate | research | community | accountability
  target_count  int,                    -- optional numeric target (e.g., 10 votes)
  current_count int not null default 0,
  status        text not null default 'active',
  -- active | completed | abandoned
  is_public     boolean not null default true,
  deadline      timestamptz,            -- optional completion deadline
  completed_at  timestamptz,
  witness_count int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint civic_pledges_title_length check (char_length(title) <= 200),
  constraint civic_pledges_desc_length  check (char_length(description) <= 1000),
  constraint civic_pledges_status       check (status in ('active','completed','abandoned')),
  constraint civic_pledges_category     check (category in
    ('participation','advocacy','debate','research','community','accountability'))
);

-- Who has witnessed each pledge
create table if not exists pledge_witnesses (
  id         uuid primary key default gen_random_uuid(),
  pledge_id  uuid not null references civic_pledges(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (pledge_id, user_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

create index if not exists civic_pledges_user_id_idx    on civic_pledges(user_id);
create index if not exists civic_pledges_status_idx     on civic_pledges(status);
create index if not exists civic_pledges_category_idx   on civic_pledges(category);
create index if not exists civic_pledges_created_idx    on civic_pledges(created_at desc);
create index if not exists civic_pledges_witnesses_idx  on civic_pledges(witness_count desc);
create index if not exists pledge_witnesses_pledge_idx  on pledge_witnesses(pledge_id);
create index if not exists pledge_witnesses_user_idx    on pledge_witnesses(user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────

alter table civic_pledges   enable row level security;
alter table pledge_witnesses enable row level security;

-- Public pledges readable by all; private only by owner
create policy "Civic pledges: public readable"
  on civic_pledges for select
  using (is_public = true or auth.uid() = user_id);

-- Owner can insert/update/delete own pledges
create policy "Civic pledges: owner write"
  on civic_pledges for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Witnesses readable by all
create policy "Pledge witnesses: public readable"
  on pledge_witnesses for select
  using (true);

-- Authenticated users can add/remove their own witness
create policy "Pledge witnesses: authenticated insert"
  on pledge_witnesses for insert
  with check (auth.uid() = user_id);

create policy "Pledge witnesses: owner delete"
  on pledge_witnesses for delete
  using (auth.uid() = user_id);

-- ── Trigger: keep witness_count in sync ────────────────────────────────────────

create or replace function sync_pledge_witness_count()
returns trigger language plpgsql security definer as $$
begin
  if (TG_OP = 'INSERT') then
    update civic_pledges
    set witness_count = witness_count + 1,
        updated_at    = now()
    where id = NEW.pledge_id;
  elsif (TG_OP = 'DELETE') then
    update civic_pledges
    set witness_count = greatest(0, witness_count - 1),
        updated_at    = now()
    where id = OLD.pledge_id;
  end if;
  return null;
end;
$$;

drop trigger if exists pledge_witness_count_trigger on pledge_witnesses;
create trigger pledge_witness_count_trigger
  after insert or delete on pledge_witnesses
  for each row execute procedure sync_pledge_witness_count();

-- ── Trigger: auto-complete when current_count reaches target_count ─────────────

create or replace function auto_complete_pledge()
returns trigger language plpgsql security definer as $$
begin
  if NEW.target_count is not null
     and NEW.current_count >= NEW.target_count
     and NEW.status = 'active'
  then
    NEW.status       := 'completed';
    NEW.completed_at := now();
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;

drop trigger if exists pledge_auto_complete on civic_pledges;
create trigger pledge_auto_complete
  before update on civic_pledges
  for each row execute procedure auto_complete_pledge();
