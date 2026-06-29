-- Civic Integrity Monitor: platform health, vote-pattern signals, and coordinated activity detection

create table if not exists public.integrity_signals (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null check (signal_type in (
    'vote_cluster',      -- unusual vote timing cluster
    'coordinated_swing', -- rapid multi-user vote flip on same topic
    'sock_puppet',       -- new accounts voting in sync
    'topic_spam',        -- burst topic creation from same user
    'argument_flood'     -- mass duplicate arguments
  )),
  severity text not null default 'low' check (severity in ('low','medium','high','critical')),
  topic_id uuid references public.topics(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}',
  resolved boolean not null default false,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.integrity_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique default current_date,
  total_votes bigint not null default 0,
  unique_voters bigint not null default 0,
  flagged_votes bigint not null default 0,
  new_topics bigint not null default 0,
  rejected_topics bigint not null default 0,
  new_users bigint not null default 0,
  active_signals bigint not null default 0,
  health_score numeric(5,2) not null default 100.0,
  created_at timestamptz not null default now()
);

create index if not exists integrity_signals_type_idx on public.integrity_signals(signal_type);
create index if not exists integrity_signals_severity_idx on public.integrity_signals(severity);
create index if not exists integrity_signals_resolved_idx on public.integrity_signals(resolved);
create index if not exists integrity_signals_created_at_idx on public.integrity_signals(created_at desc);
create index if not exists integrity_snapshots_date_idx on public.integrity_snapshots(snapshot_date desc);

-- Seed 30 days of snapshots with realistic declining/recovering health score
do $$
declare
  i int;
  base_score numeric := 97.0;
  score numeric;
  votes bigint;
  voters bigint;
  flagged bigint;
  topics bigint;
  rejected bigint;
  users bigint;
  signals bigint;
begin
  for i in reverse 29..0 loop
    score := base_score + (random() * 4 - 2);
    score := greatest(70.0, least(100.0, score));
    votes := 800 + floor(random() * 400);
    voters := floor(votes * (0.6 + random() * 0.2));
    flagged := floor(votes * (random() * 0.03));
    topics := 20 + floor(random() * 30);
    rejected := floor(topics * (random() * 0.1));
    users := 15 + floor(random() * 25);
    signals := floor(random() * 5);

    insert into public.integrity_snapshots (
      snapshot_date, total_votes, unique_voters, flagged_votes,
      new_topics, rejected_topics, new_users, active_signals, health_score
    ) values (
      current_date - i,
      votes, voters, flagged,
      topics, rejected, users, signals,
      round(score, 2)
    )
    on conflict (snapshot_date) do nothing;

    base_score := score;
  end loop;
end;
$$;

-- Seed some sample signals
insert into public.integrity_signals (signal_type, severity, details) values
  ('vote_cluster', 'medium', '{"note":"12 votes in 3 seconds on topic abc","topic_title":"Should lobbying be banned?"}'),
  ('coordinated_swing', 'high', '{"note":"8 accounts flipped from For to Against within 1 minute","topic_title":"Universal Basic Income pilot"}'),
  ('argument_flood', 'low', '{"note":"4 near-identical arguments submitted in 10 minutes"}'),
  ('topic_spam', 'low', '{"note":"3 topics created by same user in 5 minutes"}')
on conflict do nothing;

alter table public.integrity_signals enable row level security;
alter table public.integrity_snapshots enable row level security;

-- Everyone can read signals and snapshots (transparency)
create policy "integrity_signals_select" on public.integrity_signals
  for select using (true);

create policy "integrity_snapshots_select" on public.integrity_snapshots
  for select using (true);
