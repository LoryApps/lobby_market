-- =============================================================================
-- Lobby Market: Civic Elections
-- =============================================================================
-- Monthly democratic elections for platform council roles.
-- Citizens nominate themselves and the community votes for representatives.
--
-- Tables:
--   elections        — election metadata (monthly, per-role)
--   election_nominees — candidates with nomination statements
--   election_votes   — one vote per user per election
-- =============================================================================

-- ── 1. Elections table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS elections (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 3 AND 64),
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT        NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),
  role        TEXT        NOT NULL CHECK (role IN ('senator', 'lawmaker', 'troll_catcher', 'elder')),
  seats       INT         NOT NULL DEFAULT 3 CHECK (seats BETWEEN 1 AND 20),
  starts_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at     TIMESTAMPTZ NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'upcoming'
              CHECK (status IN ('upcoming', 'active', 'completed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT elections_end_after_start CHECK (ends_at > starts_at)
);

-- ── 2. Nominees table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS election_nominees (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID        NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  statement   TEXT        NOT NULL CHECK (char_length(statement) BETWEEN 10 AND 500),
  vote_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (election_id, user_id)
);

-- ── 3. Votes table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS election_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID        NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  voter_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nominee_id  UUID        NOT NULL REFERENCES election_nominees(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One vote per user per election
  UNIQUE (election_id, voter_id)
);

-- ── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_elections_status
  ON elections (status, ends_at DESC);

CREATE INDEX IF NOT EXISTS idx_election_nominees_election
  ON election_nominees (election_id, vote_count DESC);

CREATE INDEX IF NOT EXISTS idx_election_votes_nominee
  ON election_votes (nominee_id);

CREATE INDEX IF NOT EXISTS idx_election_votes_voter
  ON election_votes (voter_id, election_id);

-- ── 5. Vote count trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_election_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE election_nominees
  SET vote_count = vote_count + 1
  WHERE id = NEW.nominee_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_election_vote_count
  AFTER INSERT ON election_votes
  FOR EACH ROW EXECUTE FUNCTION increment_election_vote_count();

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE elections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_nominees  ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_votes     ENABLE ROW LEVEL SECURITY;

-- Elections: public read
CREATE POLICY "elections_public_read" ON elections
  FOR SELECT USING (true);

-- Nominees: public read
CREATE POLICY "nominees_public_read" ON election_nominees
  FOR SELECT USING (true);

-- Nominees: authenticated users can self-nominate
CREATE POLICY "nominees_self_insert" ON election_nominees
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Votes: public read
CREATE POLICY "election_votes_public_read" ON election_votes
  FOR SELECT USING (true);

-- Votes: authenticated users can vote
CREATE POLICY "election_votes_insert" ON election_votes
  FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- ── 7. Seed initial elections ─────────────────────────────────────────────────

INSERT INTO elections (slug, title, description, role, seats, starts_at, ends_at, status)
VALUES
  (
    'senate-may-2026',
    'Senate Elections — May 2026',
    'Elect three Senators to represent the civic community for the next 30 days. Senators gain enhanced voting weight and the ability to fast-track topics to the active chamber.',
    'senator',
    3,
    now() - interval '2 days',
    now() + interval '28 days',
    'active'
  ),
  (
    'troll-catchers-may-2026',
    'Troll Catcher Council — May 2026',
    'Choose two community members to serve as Troll Catchers — the first line of defence against bad-faith arguments. Troll Catchers can flag and suppress low-quality content.',
    'troll_catcher',
    2,
    now() - interval '1 day',
    now() + interval '29 days',
    'active'
  ),
  (
    'senate-april-2026',
    'Senate Elections — April 2026',
    'The April 2026 Senate election. Senators were elected to represent the Lobby for one month.',
    'senator',
    3,
    now() - interval '35 days',
    now() - interval '5 days',
    'completed'
  )
ON CONFLICT (slug) DO NOTHING;
