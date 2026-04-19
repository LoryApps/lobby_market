-- Topic pinned sources: factual citations attached to a topic
-- Created by topic owner or moderator, max 5 per topic.

create table if not exists public.topic_sources (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid not null references public.topics(id) on delete cascade,
  added_by    uuid not null references public.profiles(id) on delete cascade,
  url         text not null,
  title       text not null,
  description text,
  domain      text generated always as (
    regexp_replace(
      regexp_replace(url, '^https?://(www\.)?', ''),
      '/.*$', ''
    )
  ) stored,
  display_order smallint not null default 0,
  created_at  timestamptz not null default now()
);

-- Only one source per url per topic
create unique index if not exists topic_sources_topic_url_key
  on public.topic_sources(topic_id, url);

-- Fast lookup by topic
create index if not exists topic_sources_topic_id_idx
  on public.topic_sources(topic_id, display_order);

-- RLS
alter table public.topic_sources enable row level security;

-- Anyone can read sources
create policy "topic_sources_select"
  on public.topic_sources for select
  using (true);

-- Topic creator or moderator can insert (max 5 enforced at API layer)
create policy "topic_sources_insert"
  on public.topic_sources for insert
  with check (auth.uid() = added_by);

-- Only the adder can delete their source
create policy "topic_sources_delete"
  on public.topic_sources for delete
  using (auth.uid() = added_by);
