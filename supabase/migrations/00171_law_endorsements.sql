create table if not exists public.law_endorsements (
  id          uuid primary key default gen_random_uuid(),
  law_id      uuid not null references public.laws(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  message     text check (char_length(message) <= 280),
  created_at  timestamptz not null default now(),
  unique (law_id, user_id)
);

alter table public.law_endorsements enable row level security;

create policy "Anyone can view endorsements"
  on public.law_endorsements for select
  using (true);

create policy "Authenticated users can endorse"
  on public.law_endorsements for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own endorsement"
  on public.law_endorsements for delete
  using (auth.uid() = user_id);

create index law_endorsements_law_id_idx  on public.law_endorsements (law_id);
create index law_endorsements_user_id_idx on public.law_endorsements (user_id);
create index law_endorsements_created_at_idx on public.law_endorsements (created_at desc);
