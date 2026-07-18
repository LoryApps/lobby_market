-- Exchange Market Forecasts
-- Users submit price targets with time horizons and reasoning.
-- Enables "wisdom of crowds" forecast aggregation per market.

create table if not exists public.exchange_forecasts (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid not null references public.topics(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- Target price in cents (0-100)
  target_price  integer not null check (target_price >= 0 and target_price <= 100),
  -- Optional reasoning (max 500 chars)
  reasoning     text check (char_length(reasoning) <= 500),
  -- When the user expects the price to reach the target
  horizon       text not null default '30d' check (horizon in ('7d', '14d', '30d', '90d', '180d')),
  -- Direction bias
  direction     text not null check (direction in ('bullish', 'bearish', 'neutral')),
  -- Confidence (1 = low, 5 = high)
  confidence    integer not null default 3 check (confidence >= 1 and confidence <= 5),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- One forecast per user per topic (upsert on conflict)
  unique (topic_id, user_id)
);

alter table public.exchange_forecasts enable row level security;

-- Read: anyone can read forecasts
create policy "forecasts_read" on public.exchange_forecasts
  for select using (true);

-- Write: only own forecast
create policy "forecasts_insert" on public.exchange_forecasts
  for insert with check (auth.uid() = user_id);

create policy "forecasts_update" on public.exchange_forecasts
  for update using (auth.uid() = user_id);

create policy "forecasts_delete" on public.exchange_forecasts
  for delete using (auth.uid() = user_id);

-- Index for fast market lookups
create index if not exists exchange_forecasts_topic_idx
  on public.exchange_forecasts(topic_id, created_at desc);

create index if not exists exchange_forecasts_user_idx
  on public.exchange_forecasts(user_id, created_at desc);
