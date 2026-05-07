-- 00062_topic_synthesis.sql
-- Caches AI-generated argument synthesis for each topic.
-- Distinct from topic_ai_briefs (neutral summary) — synthesis finds
-- common ground, core tensions, and a potential compromise position.

create table if not exists topic_synthesis (
  topic_id       uuid        not null primary key references topics(id) on delete cascade,
  common_ground  text        not null,
  tensions       text        not null,
  synthesis      text        not null,
  argument_hash  text        not null,
  model          text        not null default 'claude-sonnet-4-6',
  generated_at   timestamptz not null default now()
);

-- Only the topic owner or any authenticated user can trigger generation;
-- reads are public.
alter table topic_synthesis enable row level security;

create policy "Anyone can read synthesis"
  on topic_synthesis for select using (true);

create policy "Authenticated users can upsert synthesis"
  on topic_synthesis for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update synthesis"
  on topic_synthesis for update
  using (auth.role() = 'authenticated');
