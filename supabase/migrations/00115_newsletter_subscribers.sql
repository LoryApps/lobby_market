-- Newsletter subscribers table for email subscription signup
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  constraint newsletter_subscribers_email_unique unique (email)
);

alter table public.newsletter_subscribers enable row level security;

-- Anyone can subscribe (insert their email)
create policy "anyone_can_subscribe"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (
    email ~* '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
  );

-- Add newsletter opt-in flag to profiles for logged-in users
alter table public.profiles
  add column if not exists newsletter_opt_in boolean not null default false;

comment on table public.newsletter_subscribers is
  'Email-only newsletter subscribers (non-authenticated or anonymous sign-ups).';
