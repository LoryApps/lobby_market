-- ─── Civic Referrals ──────────────────────────────────────────────────────────
--
-- Tracks invite links clicked from /invite/[username] and attributes new
-- signups to the referrer. Invite codes equal the referrer's username.
--

create table if not exists civic_referrals (
  id            uuid        primary key default gen_random_uuid(),
  referrer_id   uuid        not null references auth.users(id) on delete cascade,
  invite_code   text        not null,         -- referrer's username at time of invite
  referee_id    uuid        references auth.users(id) on delete set null,
  clout_awarded integer     not null default 0,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz                    -- set when referee signs up
);

create index if not exists civic_referrals_referrer_idx
  on civic_referrals(referrer_id);

create index if not exists civic_referrals_invite_code_idx
  on civic_referrals(invite_code);

alter table civic_referrals enable row level security;

-- Referrer can read their own records
create policy "referrer_select"
  on civic_referrals for select
  using (auth.uid() = referrer_id);

-- Any authenticated user can insert (to log a referral visit)
create policy "authenticated_insert"
  on civic_referrals for insert
  with check (auth.uid() is not null);

-- Referrer can update (e.g. mark completed)
create policy "referrer_update"
  on civic_referrals for update
  using (auth.uid() = referrer_id);
