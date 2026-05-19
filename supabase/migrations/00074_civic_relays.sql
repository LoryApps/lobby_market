-- =============================================================================
-- Lobby Market: Civic Relays
-- =============================================================================
-- A collaborative argument-chaining format. One user starts a relay with a
-- seed argument; up to 4 others each add one leg, building a collective case
-- FOR or AGAINST a topic. When all legs are submitted, the relay is "complete"
-- and any authenticated user can vote on whether it's compelling.
--
-- Distinct from:
--   topic_arguments   — solo arguments
--   argument_replies  — rebuttals (adversarial)
--   debates           — structured timed events
--   civic_polls       — 4-option quick polls
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_relays (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      UUID        REFERENCES topics(id) ON DELETE CASCADE,
  side          TEXT        NOT NULL CHECK (side IN ('for', 'against')),
  starter_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'in_progress', 'complete', 'voted')),
  max_legs      INT         NOT NULL DEFAULT 5,
  vote_compelling     INT   NOT NULL DEFAULT 0,
  vote_not_compelling INT   NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

ALTER TABLE civic_relays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read relays"
  ON civic_relays FOR SELECT USING (true);

CREATE POLICY "Auth users can start relays"
  ON civic_relays FOR INSERT
  WITH CHECK (auth.uid() = starter_id);

CREATE POLICY "Auth users can update relay status/votes"
  ON civic_relays FOR UPDATE
  USING (true);

-- ─── Relay Legs (each participant's contribution) ─────────────────────────────

CREATE TABLE IF NOT EXISTS relay_legs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_id    UUID        NOT NULL REFERENCES civic_relays(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  leg_number  INT         NOT NULL CHECK (leg_number BETWEEN 1 AND 5),
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 30 AND 300),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (relay_id, leg_number),
  UNIQUE (relay_id, author_id)
);

ALTER TABLE relay_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read relay legs"
  ON relay_legs FOR SELECT USING (true);

CREATE POLICY "Auth users can add relay legs"
  ON relay_legs FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- ─── Relay Votes (compelling / not compelling) ────────────────────────────────

CREATE TABLE IF NOT EXISTS relay_votes (
  relay_id    UUID        NOT NULL REFERENCES civic_relays(id) ON DELETE CASCADE,
  voter_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote        TEXT        NOT NULL CHECK (vote IN ('compelling', 'not_compelling')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (relay_id, voter_id)
);

ALTER TABLE relay_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read relay votes"
  ON relay_votes FOR SELECT USING (true);

CREATE POLICY "Auth users can vote on relays"
  ON relay_votes FOR INSERT
  WITH CHECK (auth.uid() = voter_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_relays_topic_id   ON civic_relays(topic_id);
CREATE INDEX IF NOT EXISTS idx_civic_relays_starter_id ON civic_relays(starter_id);
CREATE INDEX IF NOT EXISTS idx_civic_relays_status     ON civic_relays(status);
CREATE INDEX IF NOT EXISTS idx_civic_relays_created_at ON civic_relays(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relay_legs_relay_id     ON relay_legs(relay_id);
CREATE INDEX IF NOT EXISTS idx_relay_legs_author_id    ON relay_legs(author_id);
