-- 00063_tag_ai_briefs.sql
-- Caches AI-generated civic briefs for topic tags.
-- Each brief summarises the overall consensus lean, key tensions,
-- and an aggregate insight across all topics that share a given tag.
-- Invalidated via tag_hash whenever the set of topics changes.

create table if not exists tag_ai_briefs (
  tag              text        not null primary key,
  overview         text        not null,
  lean             text        not null,
  tension          text        not null,
  insight          text        not null,
  topic_count      int         not null default 0,
  avg_for_pct      numeric(5,2),
  tag_hash         text        not null,
  model            text        not null default 'claude-sonnet-4-6',
  generated_at     timestamptz not null default now()
);

alter table tag_ai_briefs enable row level security;

create policy "Anyone can read tag briefs"
  on tag_ai_briefs for select using (true);

create policy "Authenticated users can upsert tag briefs"
  on tag_ai_briefs for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update tag briefs"
  on tag_ai_briefs for update
  using (auth.role() = 'authenticated');
